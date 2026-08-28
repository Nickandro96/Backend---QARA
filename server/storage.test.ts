import assert from "node:assert/strict";
import test from "node:test";
import { buildStoredObjectReference, parseStoredObjectReference } from "./storage";

test("stores only an internal S3 object reference", () => {
  assert.equal(buildStoredObjectReference("qara-reports", "reports/7/audit.pdf"), "s3://qara-reports/reports/7/audit.pdf");
});

test("extracts an object key only for the configured bucket", () => {
  assert.equal(parseStoredObjectReference("s3://qara-reports/reports/7/audit.pdf", "qara-reports"), "reports/7/audit.pdf");
  assert.throws(() => parseStoredObjectReference("s3://other/reports/8/audit.pdf", "qara-reports"));
  assert.throws(() => parseStoredObjectReference("file:///tmp/qara-local-storage/audit.pdf", "qara-reports"));
});

test("accepts historical direct S3 references without returning them to clients", () => {
  assert.equal(
    parseStoredObjectReference("https://qara-reports.s3.eu-west-3.amazonaws.com/reports/7/audit.docx", "qara-reports"),
    "reports/7/audit.docx"
  );
});
