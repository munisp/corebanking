import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // NOTE: Feature routes (customer ops, billing, cards, transfers, partner onboarding,
  // exports, audit, teller, reconciliation, etc.) are currently implemented as 96+
  // Express REST endpoints in server/index.ts. Future migration to tRPC routers
  // would provide end-to-end type safety between client and server.
  //
  // Candidate modules for tRPC migration:
  //   - customers (CRUD, search, segment, risk)
  //   - customerServicing (cards, transfers, bills, statements, approvals)
  //   - billing (accounts, rateCards, usageEvents, invoices, disputes)
  //   - partnerOnboarding (drafts, submissions, approvals, provisioning)
  //   - operations (workflow cases, operator actions, audit trail)
  //   - exports (statement exports, approval chains)
  //   - domainOverviews (teller, reconciliation, islamic, trade, etc.)
});

export type AppRouter = typeof appRouter;
