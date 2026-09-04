import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { notifyOwner } from "./notification";
import { adminProcedure, publicProcedure, router } from "./trpc";
import * as db from "../db";
import { sdk } from "./sdk";
import { COOKIE_NAME, ONE_YEAR_MS } from "../../shared/const";
import { getSessionCookieOptions } from "./cookies";
import { hashPassword, verifyPassword, isLegacyHash } from "./passwordUtils";

function errMsg(e: any) {
  if (!e) return "unknown";
  if (typeof e === "string") return e;
  return e?.message || e?.cause?.message || JSON.stringify(e);
}

export const systemRouter = router({
  health: publicProcedure
    .input(z.object({ timestamp: z.number().min(0) }))
    .query(() => ({ ok: true })),

  /**
   * Route temporaire pour créer un utilisateur local et se connecter.
   * À utiliser uniquement pour le premier utilisateur ou en développement.
   */
  devLogin: publicProcedure
    .input(z.object({ email: z.string().email(), name: z.string() }))
    .mutation(async ({ input, ctx }) => {
      if (process.env.NODE_ENV === "production") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "devLogin is disabled in production.",
        });
      }

      const dbConn = await db.getDb();
      if (!dbConn) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            "DB indisponible. Vérifie que DATABASE_URL (ou MYSQL_URL/vars Railway) est bien défini dans le service Backend.",
        });
      }

      const openId = `local_${input.email}`;

      await db.upsertUser({
        openId,
        name: input.name,
        email: input.email,
        loginMethod: "local",
        lastSignedIn: new Date(),
        role: "admin",
      });

      const sessionToken = await sdk.createSessionToken(openId, { name: input.name });

      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, sessionToken, {
        ...cookieOptions,
        maxAge: ONE_YEAR_MS,
        httpOnly: true,
        secure: true,
        sameSite: "none",
      });

      return { success: true, message: "Utilisateur créé et connecté localement" };
    }),

  /**
   * Route pour s'inscrire avec email et mot de passe
   */
  register: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        name: z.string().min(2),
        password: z.string().min(6),
        company: z.string().optional(),
        role: z.string().optional(),
        phone: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const dbConn = await db.getDb();
      if (!dbConn) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            "DB indisponible. Vérifie DATABASE_URL (ou MYSQL_URL/vars Railway) dans le service Backend.",
        });
      }

      const existingUser = await db.getUserByEmail(input.email);
      if (existingUser) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Un utilisateur avec cet email existe déjà" });
      }

      const openId = `local_${input.email}`;
      const hashedPassword = hashPassword(input.password);

      await db.upsertUser({
        openId,
        name: input.name,
        email: input.email,
        loginMethod: "local_password",
        lastSignedIn: new Date(),
        role: "user",
      });

      await db.storePasswordHash(openId, hashedPassword);

      const sessionToken = await sdk.createSessionToken(openId, { name: input.name });

      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, sessionToken, {
        ...cookieOptions,
        maxAge: ONE_YEAR_MS,
        httpOnly: true,
        secure: true,
        sameSite: "none",
      });

      return { success: true, message: "Inscription réussie" };
    }),

  /**
   * Route pour se connecter avec email et mot de passe
   */
  login: publicProcedure
    .input(z.object({ email: z.string().email(), password: z.string() }))
    .mutation(async ({ input, ctx }) => {
      // ✅ 1) DB check upfront (la cause la + fréquente du 500)
      const dbConn = await db.getDb();
      if (!dbConn) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            "DB indisponible. Vérifie DATABASE_URL (ou MYSQL_URL/vars Railway) dans le service Backend.",
        });
      }

      try {
        console.log("[Login] Start for:", input.email);

        const user = await db.getUserByEmail(input.email);
        console.log("[Login] getUserByEmail:", user ? `found id=${user.id}` : "not found");

        if (!user || !user.openId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Email ou mot de passe incorrect" });
        }

        const storedHash = await db.getPasswordHash(user.openId);
        if (!storedHash || !verifyPassword(input.password, storedHash)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Email ou mot de passe incorrect" });
        }

        // Transparent upgrade: accounts created before the scrypt migration
        // still have a plaintext hash. Re-hash it now that we know the password is correct.
        if (isLegacyHash(storedHash)) {
          await db.storePasswordHash(user.openId, hashPassword(input.password));
        }

        // NOTE: email must be passed here — `users.email` is the only unique key upsertUser
        // relies on for its ON DUPLICATE KEY UPDATE; omitting it caused a NOT NULL insert failure
        // on every login (pre-existing bug, unrelated to this lot's scope, fixed because it
        // blocked validating the auth changes above end-to-end).
        await db.upsertUser({ openId: user.openId, email: user.email, lastSignedIn: new Date() });

        const sessionToken = await sdk.createSessionToken(user.openId, { name: user.name });

        const cookieOptions = getSessionCookieOptions(ctx.req);
        if (!ctx.res || typeof (ctx.res as any).cookie !== "function") {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Réponse HTTP indisponible pour définir le cookie de session (ctx.res.cookie).",
          });
        }

        ctx.res.cookie(COOKIE_NAME, sessionToken, {
          ...cookieOptions,
          maxAge: ONE_YEAR_MS,
          httpOnly: true,
          secure: true,
          sameSite: "none",
        });

        return { success: true, message: "Connexion réussie" };
      } catch (e: any) {
        // ✅ 2) Ne plus masquer l’erreur réelle
        console.error("[Login] ERROR:", e);
        if (e instanceof TRPCError) throw e;

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Login backend error: ${errMsg(e)}`,
        });
      }
    }),

  notifyOwner: adminProcedure
    .input(z.object({ title: z.string().min(1), content: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const delivered = await notifyOwner(input);
      return { success: delivered } as const;
    }),

  listUsers: adminProcedure.query(async () => {
    const users = await db.listAllUsers();
    const profiles = await db.listAllUserProfiles();

    return users.map((user) => ({
      ...user,
      profile: profiles.find((p) => p.id === user.id) || null,
    }));
  }),

  updateUserRole: adminProcedure
    .input(z.object({ userId: z.number(), role: z.enum(["user", "admin"]) }))
    .mutation(async ({ input }) => {
      await db.updateUserRole(input.userId, input.role);
      return { success: true };
    }),

  updateUserProfile: adminProcedure
    .input(
      z.object({
        userId: z.number(),
        subscriptionTier: z.enum(["free", "pro", "expert", "entreprise"]).optional(),
        subscriptionStatus: z.enum(["active", "canceled", "past_due", "trialing"]).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { userId, ...data } = input;
      await db.upsertUserProfile(userId, data as any);
      return { success: true };
    }),
});
