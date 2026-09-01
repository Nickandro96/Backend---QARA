import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { notifyOwner } from "./notification";
import { adminProcedure, publicProcedure, router } from "./trpc";
import * as db from "../db";
import { sdk } from "./sdk";
import { COOKIE_NAME, ONE_YEAR_MS } from "../../shared/const";
import { getSessionCookieOptions } from "./cookies";
import { hashPassword, verifyPassword, isBcryptHash } from "./passwordUtils";
import { createResetToken, hashResetToken, sendPasswordResetEmail } from "./passwordReset";
import { sendWelcomeEmail } from "./legalEmails";

function errMsg(e: any) {
  if (!e) return "unknown";
  if (typeof e === "string") return e;
  return e?.message || e?.cause?.message || JSON.stringify(e);
}

export const systemRouter = router({
  health: publicProcedure
    .input(z.object({ timestamp: z.number().min(0) }))
    .query(() => ({ ok: true })),

  requestPasswordReset: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input }) => {
      const genericResult = {
        success: true,
        message: "Si un compte existe pour cet email, un lien de réinitialisation sera envoyé.",
      } as const;
      if (!(await db.getDb())) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Service temporairement indisponible." });
      }
      const user = await db.getUserByEmail(input.email.trim());

      if (!user || user.loginMethod !== "local_password") return genericResult;

      const { token, tokenHash, expiresAt } = createResetToken();
      const created = await db.createPasswordResetToken(user.id, tokenHash, expiresAt);
      if (!created) return genericResult;
      try {
        await sendPasswordResetEmail(user.email, token);
      } catch (error) {
        console.error("[PasswordReset] Email delivery failed:", error);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Impossible d'envoyer l'email pour le moment." });
      }
      return genericResult;
    }),

  resetPassword: publicProcedure
    .input(z.object({ token: z.string().min(32).max(200), password: z.string().min(6).max(200) }))
    .mutation(async ({ input }) => {
      const changed = await db.resetPasswordWithToken(
        hashResetToken(input.token),
        () => hashPassword(input.password)
      );
      if (!changed) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Ce lien de réinitialisation est invalide, expiré ou déjà utilisé.",
        });
      }
      return { success: true, message: "Votre mot de passe a été réinitialisé." } as const;
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
        cguAccepted: z.literal(true, { error: "Vous devez accepter les CGU" }),
        marketingConsent: z.boolean().optional().default(false),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (input.cguAccepted !== true) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Vous devez accepter les CGU pour créer un compte" });
      }
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
      const hashedPassword = await hashPassword(input.password);

      await db.upsertUser({
        openId,
        name: input.name,
        email: input.email,
        loginMethod: "local_password",
        lastSignedIn: new Date(),
        role: "user",
      });

      await db.storePasswordHash(openId, hashedPassword);
      await db.recordLegalConsent(openId, {
        cguVersion: process.env.CGU_VERSION || "2026-09-01",
        marketingConsent: input.marketingConsent,
      });

      const sessionToken = await sdk.createSessionToken(openId, { name: input.name });

      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, sessionToken, {
        ...cookieOptions,
        maxAge: ONE_YEAR_MS,
      });

      try {
        await sendWelcomeEmail(input.email, input.name);
      } catch (error) {
        // L'échec d'un email transactionnel ne doit pas annuler un compte déjà créé.
        console.error("[Register] Welcome email delivery failed:", error);
      }

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
        const user = await db.getUserByEmail(input.email);

        if (!user || !user.openId || !user.email) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Email ou mot de passe incorrect" });
        }

        const storedHash = await db.getPasswordHash(user.openId);
        if (!storedHash || !(await verifyPassword(input.password, storedHash))) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Email ou mot de passe incorrect" });
        }

        // Migration transparente : si le mot de passe stocké n'est pas encore un hash
        // bcrypt (compte créé avant ce correctif), on le remplace maintenant qu'on a
        // confirmé le mot de passe en clair — voir passwordUtils.ts.
        if (!isBcryptHash(storedHash)) {
          await db.storePasswordHash(user.openId, await hashPassword(input.password));
        }

        // Ne met à jour que lastSignedIn : un appel à upsertUser ici sans email/name
        // enverrait `email: null` sur une colonne NOT NULL et ferait échouer CHAQUE
        // reconnexion (voir docs/audit/02-audit-technique.md, C-06).
        await db.upsertUser({
          openId: user.openId,
          name: user.name ?? undefined,
          email: user.email,
          loginMethod: user.loginMethod ?? undefined,
          role: user.role as any,
          lastSignedIn: new Date(),
        });

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
      profile: profiles.find((p) => p.userId === user.id) || null,
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

