import type { RawSignal } from "../lib/pipeline/types.ts";
import { fetchWithTimeout } from "./common.ts";

const SEC_BATCH_SIZE = 8;
const SEC_BATCH_DELAY_MS = 1200;

type FilingRecent = {
  accessionNumber?: string[];
  filingDate?: string[];
  form?: string[];
  primaryDocument?: string[];
};

type Submission = {
  cik: string | number;
  name: string;
  filings?: { recent?: FilingRecent };
};

function normalizeCik(cik: string | number) {
  return String(cik).replace(/^0+/, "").padStart(10, "0");
}

function archiveUrl(cik: string | number, accession: string, doc?: string) {
  const bare = String(cik).replace(/^0+/, "");
  return `https://www.sec.gov/Archives/edgar/data/${bare}/${accession.replaceAll("-", "")}/${doc ?? accession}.xml`;
}

function textBetween(xml: string, tag: string) {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return match?.[1]?.replace(/<!\[CDATA\[|\]\]>/g, "").trim() ?? "";
}

function collectSections(xml: string, tag: string) {
  return Array.from(xml.matchAll(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "gi"))).map((match) => match[1]);
}

function xmlNumber(xml: string, tags: string[]) {
  for (const tag of tags) {
    const value = tag.includes("/")
      ? Number(
          xml.match(
            new RegExp(
              `<${tag.split("/")[0]}[^>]*>[\\s\\S]*?<${tag.split("/")[1]}[^>]*>([\\d.,-]+)</${tag.split("/")[1]}>[\\s\\S]*?</${tag.split("/")[0]}>`,
              "i"
            )
          )?.[1] ?? Number.NaN
        )
      : Number(textBetween(xml, tag));
    if (Number.isFinite(value)) return value;
  }
  return 0;
}

export function parseForm4Xml(xml: string, metadata: { cik: string; accessionNumber: string; filingDate: string; companyName: string }) {
  const owner =
    textBetween(xml, "rptOwnerName") ||
    textBetween(xml, "reportingOwnerName") ||
    textBetween(xml, "nameOfReportingPerson");
  const transactions = [
    ...collectSections(xml, "nonDerivativeTransaction"),
    ...collectSections(xml, "derivativeTransaction")
  ];
  const entries = transactions.length ? transactions : [xml];
  return entries.map((entry, index) => {
    const code = textBetween(entry, "transactionCode") || textBetween(entry, "transactionAcquiredDisposedCode");
    const shares = xmlNumber(entry, ["transactionShares/value", "transactionShares", "shares", "transactionAmounts"]);
    const price = xmlNumber(entry, ["transactionPricePerShare/value", "transactionPricePerShare", "price"]);
    const ownedAfter = xmlNumber(entry, ["sharesOwnedFollowingTransaction/value", "sharesOwnedFollowingTransaction"]);
    const sentiment = code === "P" || code === "A" ? 1 : code === "S" || code === "D" ? -1 : 0;
    return {
      layer: "cash",
      source: "sec-edgar-form4",
      externalId: `${metadata.accessionNumber}:${index + 1}`,
      observedAt: `${metadata.filingDate}T00:00:00.000Z`,
      confidence: 0.92,
      freshness: 1,
      sourceRefs: [
        {
          sourceId: "sec-edgar-form4",
          url: archiveUrl(metadata.cik, metadata.accessionNumber),
          title: `${metadata.companyName} Form 4 ${metadata.accessionNumber}`,
          externalId: metadata.accessionNumber,
          observedAt: `${metadata.filingDate}T00:00:00.000Z`
        }
      ],
      payload: {
        companyName: metadata.companyName,
        cik: metadata.cik,
        reportingOwner: owner,
        transactionCode: code,
        transactionType: code === "P" || code === "A" ? "purchase" : code === "S" || code === "D" ? "sale" : "other",
        shares,
        sharesOwnedFollowing: ownedAfter,
        pricePerShare: price,
        amountUsd: shares * price,
        sentiment
      }
    } satisfies RawSignal;
  });
}

export async function fetchForm4Signals(
  cik: string,
  options: { userAgent?: string; baseUrl?: string; fetchImpl?: typeof fetch; dryRun?: boolean }
) {
  if (options.dryRun) {
    return parseForm4Xml(
      "<ownershipDocument><rptOwnerName>Satya Nadella</rptOwnerName><transactionCode>P</transactionCode><transactionShares>12000</transactionShares><transactionPricePerShare>420.15</transactionPricePerShare><sharesOwnedFollowingTransaction>180000</sharesOwnedFollowingTransaction></ownershipDocument>",
      { cik, accessionNumber: "0000000000-26-000001", filingDate: "2026-05-20", companyName: "Fixture Corp" }
    );
  }
  if (!options.userAgent) throw new Error("SEC_EDGAR_USER_AGENT is required for Form 4 requests");
  const fetchImpl = options.fetchImpl ?? fetch;
  const normalized = normalizeCik(cik);
  const response = await fetchWithTimeout(fetchImpl, `${options.baseUrl ?? "https://data.sec.gov/submissions"}/CIK${normalized}.json`, {
    headers: { accept: "application/json", "user-agent": options.userAgent }
  });
  if (!response.ok) throw new Error(`Form 4 SEC request failed: ${response.status}`);
  const payload = (await response.json()) as Submission;
  const filings = payload.filings?.recent;
  if (!filings?.accessionNumber?.length) return [];
  const signals: RawSignal[] = [];
  for (let index = 0; index < filings.accessionNumber.length; index += 1) {
    if (filings.form?.[index] !== "4" || !filings.filingDate?.[index]) continue;
    const doc = filings.primaryDocument?.[index];
    let xml = "<ownershipDocument></ownershipDocument>";
    if (doc) {
      try {
        const filingResponse = await fetchWithTimeout(fetchImpl, archiveUrl(normalized, filings.accessionNumber[index], doc), {
          headers: { accept: "text/xml,text/html;q=0.9,*/*;q=0.1", "user-agent": options.userAgent }
        });
        if (filingResponse.ok) {
          xml = await filingResponse.text();
        }
      } catch {
        // Fall back to a minimal payload when the filing document variant cannot be fetched.
      }
    }
    signals.push(
      ...parseForm4Xml(
        xml,
        {
          cik: normalized,
          accessionNumber: filings.accessionNumber[index],
          filingDate: filings.filingDate[index],
          companyName: payload.name
        }
      )
    );
  }
  return signals;
}

export async function fetchForm4SignalsBatch(
  ciks: string[],
  options: { userAgent?: string; baseUrl?: string; fetchImpl?: typeof fetch; dryRun?: boolean }
) {
  const allSignals: RawSignal[] = [];
  for (let index = 0; index < ciks.length; index += SEC_BATCH_SIZE) {
    const batch = ciks.slice(index, index + SEC_BATCH_SIZE);
    const result = await Promise.all(batch.map((cik) => fetchForm4Signals(cik, options)));
    allSignals.push(...result.flat());
    if (index + SEC_BATCH_SIZE < ciks.length) {
      await new Promise((resolve) => setTimeout(resolve, SEC_BATCH_DELAY_MS));
    }
  }
  return allSignals;
}
