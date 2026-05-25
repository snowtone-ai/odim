import assert from "node:assert/strict";
import test from "node:test";
import { confirmationBiasTest } from "../lib/huginn/bias-test.ts";

test("confirmation bias test detects stubborn resistance to counter-evidence", () => {
  const result = confirmationBiasTest("counter-evidence contradicts thesis", "still certain and unchanged");
  assert.equal(result.passed, false);
  assert.equal(result.biasType, "confirmation_bias");
});
