import assert from "node:assert/strict";
import test from "node:test";
import { parseForm4Xml } from "../scrapers/sec-edgar-form4.ts";
import { parse8KSubmission } from "../scrapers/sec-edgar-8k.ts";
import { parse13DGDocument } from "../scrapers/sec-edgar-13dg.ts";
import { parse13FInformationTable } from "../scrapers/sec-edgar-13f.ts";
import { fetchFredSignals } from "../scrapers/fred.ts";
import { parseFederalRegisterResults } from "../scrapers/federal-register.ts";
import { parseEdinetDocuments } from "../scrapers/edinet.ts";
import { parseCompaniesHouseFilings } from "../scrapers/companies-house.ts";
import { parseUsaspendingAwards } from "../scrapers/usaspending.ts";
import { buildFixtureRawSignals } from "../lib/pipeline/fixtures.ts";
import { buildIngestionPlan } from "../lib/pipeline/ontologize.ts";
import { computeDailyDiff } from "../lib/pipeline/diff.ts";
import { checkFreshness } from "../lib/pipeline/freshness.ts";
import { computeBatchEntityScores } from "../lib/pipeline/scoring.ts";

test("Phase7 SEC expansion parsers emit deterministic signals", () => {
  const form4 = parseForm4Xml(
    "<ownershipDocument><rptOwnerName>Insider</rptOwnerName><transactionCode>P</transactionCode><transactionShares>100</transactionShares><transactionPricePerShare>10</transactionPricePerShare></ownershipDocument>",
    { cik: "1", accessionNumber: "A", filingDate: "2026-05-20", companyName: "Fixture" }
  );
  const eightK = parse8KSubmission({
    cik: "1",
    name: "Fixture",
    filings: { recent: { accessionNumber: ["B"], filingDate: ["2026-05-20"], form: ["8-K"], items: ["2.01"] } }
  });
  const stake = parse13DGDocument({
    filerName: "Fund",
    subjectCompany: "Target",
    ownershipPercent: 6.1,
    observedAt: "2026-05-20T00:00:00.000Z",
    url: "https://example.local/13d"
  });
  const holdings = parse13FInformationTable({
    filerName: "Fund",
    issuerName: "Issuer",
    valueThousands: 120000,
    shares: 10000,
    observedAt: "2026-05-20T00:00:00.000Z"
  });

  assert.equal(form4[0].source, "sec-edgar-form4");
  assert.equal(eightK[0].payload.item, "2.01");
  assert.equal(stake[0].payload.ownershipPercent, 6.1);
  assert.equal(holdings[0].payload.amountUsd, 120000000);
});

test("Phase7 public source parsers emit source-backed signals", async () => {
  const fred = await fetchFredSignals({ dryRun: true });
  const register = parseFederalRegisterResults([
    { document_number: "2026-1", publication_date: "2026-05-20", title: "EPA rule", type: "RULE", agencies: [{ name: "EPA" }] }
  ]);
  const edinet = parseEdinetDocuments([{ docID: "D1", submitDateTime: "2026-05-20T00:00:00+09:00", filerName: "Toyota" }]);
  const house = parseCompaniesHouseFilings("0123", "ASML UK", [{ date: "2026-05-20", type: "tm01" }]);
  const spending = parseUsaspendingAwards("Palantir", [{ generated_internal_id: "A1", action_date: "2026-05-20", award_amount: 100 }]);

  assert.ok(fred.length >= 10);
  assert.equal(register[0].layer, "water");
  assert.equal(edinet[0].source, "edinet");
  assert.equal(house[0].source, "companies-house");
  assert.equal(spending[0].source, "usaspending");
});

test("Phase7 scoring, diff, and freshness produce usable outputs", () => {
  const today = buildIngestionPlan(buildFixtureRawSignals());
  const yesterday = buildIngestionPlan(buildFixtureRawSignals().slice(0, -2));
  const scores = computeBatchEntityScores(today.ontologyObjects, today.rawSignals, today.ontologyLinks);
  const firstEntity = today.ontologyObjects.find((object) => object.objectType === "decision_maker");
  const diff = computeDailyDiff(today, yesterday);
  const freshness = checkFreshness([{ sourceId: "sec-edgar", lastSuccessAt: new Date().toISOString() }]);

  assert.ok(firstEntity);
  assert.ok(scores.get(firstEntity.id).score >= 0);
  assert.ok(diff.newSignals >= 0);
  assert.equal(freshness[0].status, "fresh");
});
