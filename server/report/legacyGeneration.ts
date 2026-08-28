import { TRPCError } from "@trpc/server";

/**
 * The legacy PDF-only endpoint is intentionally disabled. Keeping the
 * procedure registered gives old clients an explicit migration error without
 * allowing an audit id to reach the legacy, non-owner-scoped data loader.
 */
export function legacyReportGenerationDisabled(): never {
  throw new TRPCError({
    code: "METHOD_NOT_SUPPORTED",
    message: "Utiliser reports.generateV2",
  });
}
