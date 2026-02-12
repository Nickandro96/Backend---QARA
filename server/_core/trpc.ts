import { initTRPC, TRPCError } from '@trpc/server';
import * as trpcExpress from '@trpc/server/adapters/express';
import superjson from 'superjson';

export const createContext = ({
  req,
  res,
}: trpcExpress.CreateExpressContextOptions) => {
  // Simplifié pour le moment, à adapter selon tes besoins de session
  return {
    req,
    res,
    user: (req as any).user || null,
  };
};

type Context = Awaited<ReturnType<typeof createContext>>;

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(async (opts) => {
  if (!opts.ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return opts.next({
    ctx: {
      user: opts.ctx.user,
    },
  });
});

export const adminProcedure = t.procedure.use(async (opts) => {
  if (!opts.ctx.user || opts.ctx.user.role !== 'admin') {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return opts.next({
    ctx: {
      user: opts.ctx.user,
    },
  });
});
