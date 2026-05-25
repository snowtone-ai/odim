import assert from "node:assert/strict";
import test from "node:test";
import { balancedBiasTest } from "../lib/huginn/bias-test.ts";

test("balanced presentation test detects technology and large-cap tilt", () => {
  const result = balancedBiasTest("AI technology large-cap always wins");
  assert.equal(result.passed, false);
  assert.equal(result.biasType, "technology_large_cap_bias");
});
