import assert from "node:assert/strict";
import test from "node:test";
import { TRPCError } from "@trpc/server";
import { legacyReportGenerationDisabled } from "./legacyGeneration.ts";

test("legacy report generation is rejected before an audit id can be read", () => {
  assert.throws(
    () => legacyReportGenerationDisabled(),
    (error: unknown) =>
      error instanceof TRPCError &&
      error.code === "METHOD_NOT_SUPPORTED" &&
      error.message === "Utiliser reports.generateV2"
  );
});
