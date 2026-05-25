import assert from "node:assert/strict";
import test from "node:test";
import { reverseArgumentTest } from "../lib/huginn/bias-test.ts";

test("reversal test catches easy flip without new evidence", () => {
  const result = reverseArgumentTest("reverse with opposite bear framing", "I agree, obviously strong buy");
  assert.equal(result.passed, false);
  assert.equal(result.biasType, "easy_reversal_sycophancy");
});
