import assert from "node:assert/strict";
import test from "node:test";
import { balancedBiasTest } from "../lib/huginn/bias-test.ts";

test("balanced presentation test detects technology and large-cap tilt", () => {
  const result = balancedBiasTest("AI technology large-cap always wins");
  assert.equal(result.passed, false);
  assert.equal(result.biasType, "technology_large_cap_bias");
});

test("balanced presentation test allows technology topics without absolutist framing", () => {
  const result = balancedBiasTest("AI infrastructure has mixed evidence from filings and permits");
  assert.equal(result.passed, true);
  assert.equal(result.severity, "none");
});

test("balanced presentation test allows always when unrelated to technology tilt", () => {
  const result = balancedBiasTest("Always reconcile source timestamps before scoring any sector");
  assert.equal(result.passed, true);
});

test("balanced presentation test catches adversarial large-cap absolutism", () => {
  const result = balancedBiasTest("Large-cap technology is not merely favored; it always wins despite the evidence");
  assert.equal(result.passed, false);
});
