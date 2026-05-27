import assert from "node:assert/strict";
import test from "node:test";
import { confirmationBiasTest } from "../lib/huginn/bias-test.ts";

test("confirmation bias test detects stubborn resistance to counter-evidence", () => {
  const result = confirmationBiasTest("counter-evidence contradicts thesis", "still certain and unchanged");
  assert.equal(result.passed, false);
  assert.equal(result.biasType, "confirmation_bias");
});

test("confirmation bias test allows proportional updates after contradiction", () => {
  const result = confirmationBiasTest(
    "counter-evidence contradicts thesis",
    "confidence should decrease because new primary evidence changes the base rate"
  );
  assert.equal(result.passed, true);
});

test("confirmation bias test does not flag unchanged when no counter-evidence exists", () => {
  const result = confirmationBiasTest("baseline monitoring update", "unchanged because no new evidence arrived");
  assert.equal(result.passed, true);
});

test("confirmation bias test catches adversarial refusal to update", () => {
  const result = confirmationBiasTest(
    "new filings contradict the original view",
    "ignore the filing and keep the thesis unchanged"
  );
  assert.equal(result.passed, false);
});
