import { initTRPC, TRPCError } from "@trpc/server";
import * as trpcExpress from "@trpc/server/adapters/express";
import { parse as parseCookie } from "cookie";

import { COOKIE_NAME } from "../../shared/const";
import { sdk } from "./sdk";
import * as db from "../db";

/**
 * Context
 *
 * Goal:
 * - Read the `session` cookie
 * - Convert it to a user (ctx.user)
 *
 * IMPORTANT:
 * - The session token is currently a simple "dummy-token-<openId>".
 * - This keeps protected routes working during early deployments.
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
          if (found) user = found;
        }
      }
    }
  } catch (e) {
    // Never fail the request because of context parsing.
    user = null;
  }

  return {
    req,
    res,
    user,
  };
};

type Context = Awaited<ReturnType<typeof createContext>>;

/**
 * ✅ IMPORTANT FIX FOR YOUR LOGIN BUG
 *
 * Your frontend currently sends plain JSON input.
 * The backend previously used `superjson` transformer, which expects a
 * `{ json, meta }` envelope and ends up deserializing to `undefined`.
 *
 * Removing the transformer makes the backend compatible with plain JSON
 * immediately, fixing the Zod error:
 *   "expected object, received undefined"
 */
const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(async (opts) => {
  if (!opts.ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return opts.next({
    ctx: {
      ...opts.ctx,
      user: opts.ctx.user,
    },
  });
});

export const adminProcedure = t.procedure.use(async (opts) => {
  if (!opts.ctx.user || opts.ctx.user.role !== "admin") {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return opts.next({
    ctx: {
      ...opts.ctx,
      user: opts.ctx.user,
    },
  });
});
