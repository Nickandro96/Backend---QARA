import { initTRPC, TRPCError } from "@trpc/server";
import * as trpcExpress from "@trpc/server/adapters/express";
import { parse as parseCookie } from "cookie";

import { COOKIE_NAME } from "../../shared/const";
import { sdk } from "./sdk";
import * as db from "../db";

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
          if (found) user = found;
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
