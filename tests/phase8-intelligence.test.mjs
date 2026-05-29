import assert from "node:assert/strict";
import test from "node:test";
import { buildFixtureRawSignals } from "../lib/pipeline/fixtures.ts";
import { buildIngestionPlan } from "../lib/pipeline/ontologize.ts";
import { buildCalibrationObservations, buildCalibrationReport, adjustConfidence } from "../lib/pipeline/calibration.ts";
import { computeSourceAttribution } from "../lib/pipeline/attribution.ts";
import { detectAnomalies } from "../lib/pipeline/anomaly.ts";
import { computeDivergenceIndex } from "../lib/pipeline/sentiment.ts";
import { detectSectorRotation } from "../lib/pipeline/sector-rotation.ts";
import { aggregateByGeo } from "../lib/map/geo-drill.ts";
import { registerPushSubscription, broadcastPushAlert, drainQueuedNotifications, removePushSubscription } from "../lib/notifications/push.ts";
import { parseForm4Xml } from "../scrapers/sec-edgar-form4.ts";
import { parse13FInformationTable } from "../scrapers/sec-edgar-13f.ts";
import { parse13DGDocument } from "../scrapers/sec-edgar-13dg.ts";
import { DEMO_ENTITIES } from "../lib/map/entities.ts";

test("Phase8 calibration builds buckets and adjusts confidence", () => {
  const plan = buildIngestionPlan(buildFixtureRawSignals());
  const report = buildCalibrationReport(buildCalibrationObservations(plan.rawSignals, plan.alerts));

  assert.equal(report.buckets.length, 10);
  assert.ok(report.overallBrier >= 0);
  assert.ok(adjustConfidence(0.82, report) >= 0);
});

test("Phase8 attribution ranks sources by contribution", () => {
  const plan = buildIngestionPlan(buildFixtureRawSignals());
  const attribution = computeSourceAttribution(plan.rawSignals, plan.alerts);

  assert.ok(attribution.length > 0);
  assert.ok(attribution[0].contributionScore >= attribution.at(-1).contributionScore);
});

test("Phase8 anomaly detection finds signal spikes", () => {
  const signals = [];
  for (let index = 0; index < 35; index += 1) {
    signals.push({
      id: `s${index}`,
      fingerprint: `s${index}`,
      layer: "energy",
      source: "fixture",
      externalId: `e${index}`,
      observedAt: new Date(Date.UTC(2026, 3, index + 1)).toISOString(),
      sourceRefs: [],
      confidence: 0.8,
      freshness: 1,
      isProprietary: false,
      payload: { companyName: "Spike Corp" }
    });
  }
  for (let index = 0; index < 6; index += 1) {
    signals.push({
      id: `sx${index}`,
      fingerprint: `sx${index}`,
      layer: "energy",
      source: "fixture",
      externalId: `sx${index}`,
      observedAt: "2026-05-20T00:00:00.000Z",
      sourceRefs: [],
      confidence: 0.8,
      freshness: 1,
      isProprietary: false,
      payload: { companyName: "Spike Corp" }
    });
  }

  const anomalies = detectAnomalies(signals, "spike", "Spike Corp", 10);
  assert.ok(anomalies.length > 0);
});

test("Phase8 sentiment divergence and sector rotation are deterministic", () => {
  const divergence = computeDivergenceIndex(82, -0.3);
  const rotations = detectSectorRotation([
    { id: "1", name: "Grid Battery", score: 84, confidence: 0.8, scoreHistory: [60, 66, 72, 84] },
    { id: "2", name: "AI Data Center", score: 80, confidence: 0.78, scoreHistory: [58, 65, 73, 80] },
    { id: "3", name: "Copper Mine", score: 52, confidence: 0.72, scoreHistory: [65, 63, 58, 52] },
    { id: "4", name: "Port Terminal", score: 55, confidence: 0.7, scoreHistory: [67, 64, 60, 55] }
  ]);

  assert.ok(divergence >= 0 && divergence <= 1);
  assert.ok(rotations.length > 0);
});

test("Phase8 geo drill groups entities and push queue drains", async () => {
  const geo = aggregateByGeo(DEMO_ENTITIES);
  registerPushSubscription("test-browser");
  await broadcastPushAlert({ id: "a1", title: "Critical Permit", priority: "critical", description: "Alert body" });
  const queued = drainQueuedNotifications();
  removePushSubscription("test-browser");

  assert.ok(geo.length > 0);
  assert.equal(queued.length, 1);
});

test("SEC parsers handle richer variant payloads", () => {
  const form4 = parseForm4Xml(
    "<ownershipDocument><rptOwnerName>Owner</rptOwnerName><nonDerivativeTransaction><transactionCoding><transactionCode>P</transactionCode></transactionCoding><transactionAmounts><transactionShares><value>150</value></transactionShares><transactionPricePerShare><value>12.5</value></transactionPricePerShare></transactionAmounts><postTransactionAmounts><sharesOwnedFollowingTransaction><value>400</value></sharesOwnedFollowingTransaction></postTransactionAmounts></nonDerivativeTransaction></ownershipDocument>",
    { cik: "1", accessionNumber: "0001", filingDate: "2026-05-20", companyName: "Fixture" }
  );
  const stake = parse13DGDocument({
    filerName: "Fund",
    subjectCompany: "Target",
    document: "SCHEDULE 13G\nThe percent of class represented by amount is 8.4%\nItem 4 Passive ownership",
    observedAt: "2026-05-20T00:00:00.000Z",
    url: "https://example.local/13g"
  });
  const holdings = parse13FInformationTable({
    filerName: "Fund",
    document: "<informationTable><infoTable><nameOfIssuer>Issuer</nameOfIssuer><value>200000</value><sshPrnamt>5000</sshPrnamt></infoTable></informationTable>",
    observedAt: "2026-05-20T00:00:00.000Z"
  });

  assert.equal(form4[0].payload.amountUsd, 1875);
  assert.equal(stake[0].payload.ownershipPercent, 8.4);
  assert.equal(holdings[0].payload.amountUsd, 200000000);
});
