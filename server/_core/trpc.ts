import { initTRPC, TRPCError } from "@trpc/server";
import * as trpcExpress from "@trpc/server/adapters/express";
import { parse as parseCookie } from "cookie";

import { COOKIE_NAME } from "../../shared/const";
import { sdk } from "./sdk";
import * as db from "../db";
import { hasCapability, type PlanCapabilities } from "../plans/capabilities";

/**
 * Context
 * - reads session cookie
 * - loads user into ctx.user
 *
 * IMPORTANT:
 * - The frontend sends plain JSON input.
 * - We DO NOT use superjson transformer here to avoid "expected object, received undefined".
 */
export const createContext = async ({
  req,
  res,
}: trpcExpress.CreateExpressContextOptions) => {
  let user: any = null;

  try {
    const cookieHeader = req.headers.cookie;
    if (cookieHeader) {
      const cookies = parseCookie(cookieHeader);
      const token = cookies?.[COOKIE_NAME];
      if (token) {
        const openId = await sdk.verifySessionToken(token);
        if (openId) {
          const found = await db.getUserByOpenId(openId);
          // ctx.user est renvoyé tel quel par auth.me (publicProcedure.query
          // ((opts) => opts.ctx.user), server/routers.ts) et lu par tout code
          // qui spread ctx.user ailleurs — ne jamais y laisser passwordHash.
          if (found) {
            const { passwordHash, ...safeUser } = found as any;
            user = safeUser;
          }
        }
      }
    }
  } catch {
    user = null;
  }

  return { req, res, user };
};

type Context = Awaited<ReturnType<typeof createContext>>;

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(async (opts) => {
  if (!opts.ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
  return opts.next({ ctx: { ...opts.ctx, user: opts.ctx.user } });
});

export const adminProcedure = t.procedure.use(async (opts) => {
  if (!opts.ctx.user || opts.ctx.user.role !== "admin") {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return opts.next({ ctx: { ...opts.ctx, user: opts.ctx.user } });
});

/**
 * Gating serveur des plans (classification/FDA/veille/export) — voir
 * server/plans/capabilities.ts. Absent de qitbxl jusqu'ici : un compte
 * Free pouvait appeler ces endpoints directement via l'API en contournant
 * le gating visuel du frontend (client/src/lib/plans.ts).
 */
export function requireCapability(capability: keyof PlanCapabilities) {
  return protectedProcedure.use(async (opts) => {
    if (!hasCapability(capability, opts.ctx.user)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Fonctionnalité réservée aux plans payants.",
      });
    }
    return opts.next({ ctx: opts.ctx });
  });
}
