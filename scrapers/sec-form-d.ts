import type { RawSignal } from "../lib/pipeline/types.ts";
import { fetchWithTimeout } from "./common.ts";
import { SEC_BATCH_DELAY_MS, SEC_BATCH_SIZE } from "./sec-edgar.ts";

const DEFAULT_ARCHIVES_BASE_URL = "https://www.sec.gov/Archives/";
const DEFAULT_DAILY_INDEX_BASE_URL = "https://www.sec.gov/Archives/edgar/daily-index";
const DEFAULT_INDEX_LOOKBACK_DAYS = 7;
const MAX_INDEX_LOOKBACK_DAYS = 31;

type SecFormDIndexEntry = {
  accessionNumber: string;
  cik: string;
  companyName: string;
  filingDate: string;
  fileName: string;
  form: "D" | "D/A";
};

type SecFormDMetadata = {
  accessionNumber: string;
  cik: string;
  companyName?: string;
  filingDate: string;
  form?: "D" | "D/A";
  indexUrl?: string;
  sourceUrl: string;
};

type IndexedFiling = SecFormDIndexEntry & { indexUrl: string };

type PreparedFiling = {
  filing: IndexedFiling;
  sourceUrl: string;
  xml?: string;
  primaryUrl?: string;
};

export type SecFormDOptions = {
  archivesBaseUrl?: string;
  dailyIndexBaseUrl?: string;
  dryRun?: boolean;
  fetchImpl?: typeof fetch;
  indexLookbackDays?: number;
  limit?: number;
  now?: Date | string;
  userAgent?: string;
};

function normalizeCik(value: string | number) {
  const digits = String(value).replace(/\D/g, "").replace(/^0+/, "");
  return digits ? digits.padStart(10, "0") : "";
}

function accessionFromFileName(fileName: string) {
  const digits = fileName.match(/\/(\d{18})(?:[/.]|$)/)?.[1];
  if (digits) {
    return `${digits.slice(0, 10)}-${digits.slice(10, 12)}-${digits.slice(12)}`;
  }

  return fileName.match(/(\d{10}-\d{2}-\d{6})/)?.[1];
}

function textValue(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function xmlSections(xml: string, tag: string) {
  const qualifiedTag = `(?:[\\w.-]+:)?${tag}`;
  return Array.from(
    xml.matchAll(new RegExp(`<${qualifiedTag}\\b[^>]*>([\\s\\S]*?)</${qualifiedTag}\\s*>`, "gi"))
  ).map((match) => match[1]);
}

function xmlSection(xml: string, tag: string) {
  return xmlSections(xml, tag)[0];
}

function xmlText(xml: string, ...tags: string[]) {
  for (const tag of tags) {
    const value = xmlSection(xml, tag);
    if (value !== undefined) {
      const parsed = textValue(value);
      if (parsed) return parsed;
    }
  }
  return undefined;
}

function xmlAmount(xml: string, ...tags: string[]) {
  const value = xmlText(xml, ...tags);
  if (!value) return undefined;
  const normalized = value.replace(/[$,\s]/g, "");
  if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) return undefined;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : undefined;
}

function compactAddress(xml: string, tag: string) {
  const section = xmlSection(xml, tag);
  if (!section) return undefined;
  const address = Object.fromEntries(
    Object.entries({
      city: xmlText(section, "city"),
      stateOrCountry: xmlText(section, "stateOrCountry"),
      stateOrCountryDescription: xmlText(section, "stateOrCountryDescription"),
      street1: xmlText(section, "street1"),
      street2: xmlText(section, "street2"),
      zipCode: xmlText(section, "zipCode")
    }).filter(([, value]) => value !== undefined)
  );
  return Object.keys(address).length ? address : undefined;
}

function relatedPeople(xml: string) {
  const list = xmlSection(xml, "relatedPersonsList") ?? "";
  return xmlSections(list, "relatedPersonInfo")
    .map((person) => {
      const nameSection = xmlSection(person, "relatedPersonName") ?? person;
      const individualName = [
        xmlText(nameSection, "firstName"),
        xmlText(nameSection, "middleName"),
        xmlText(nameSection, "lastName"),
        xmlText(nameSection, "suffix")
      ]
        .filter(Boolean)
        .join(" ");
      const name = xmlText(nameSection, "entityName", "name") ?? individualName;
      if (!name) return undefined;
      const address = compactAddress(person, "relatedPersonAddress");
      return {
        ...(address ? { address } : {}),
        name,
        relationship: xmlText(person, "relationship", "relationshipType")
      };
    })
    .filter((person): person is NonNullable<typeof person> => person !== undefined);
}

function observedAt(filingDate: string) {
  const parsed = new Date(filingDate);
  return Number.isNaN(parsed.valueOf()) ? filingDate : parsed.toISOString();
}

function dateForIndex(value: Date | string | undefined) {
  const parsed = value instanceof Date ? new Date(value) : new Date(value ?? Date.now());
  if (Number.isNaN(parsed.valueOf())) throw new Error("SEC Form D now must be a valid date");
  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
}

function dailyIndexUrl(baseUrl: string, date: Date) {
  const year = date.getUTCFullYear();
  const quarter = Math.floor(date.getUTCMonth() / 3) + 1;
  const yyyymmdd = `${year}${String(date.getUTCMonth() + 1).padStart(2, "0")}${String(date.getUTCDate()).padStart(2, "0")}`;
  return `${baseUrl.replace(/\/+$/, "")}/${year}/QTR${quarter}/form.${yyyymmdd}.idx`;
}

function documentUrl(archivesBaseUrl: string, fileName: string) {
  if (/^https?:\/\//i.test(fileName)) return fileName;
  const path = fileName.replace(/^\/+/, "").replace(/^Archives\//i, "");
  return new URL(path, archivesBaseUrl.endsWith("/") ? archivesBaseUrl : `${archivesBaseUrl}/`).toString();
}

function isXmlFileName(fileName: string) {
  return /\.xml(?:[?#].*)?$/i.test(fileName);
}

function primaryXmlFileName(submission: string, form: "D" | "D/A") {
  const documents = submission.split(/<DOCUMENT>/i).slice(1);
  for (const document of documents) {
    const type = document.match(/<TYPE>\s*([^\s<]+)/i)?.[1]?.trim();
    const fileName = document.match(/<FILENAME>\s*([^\s<]+)/i)?.[1]?.trim();
    if (type === form && fileName && isXmlFileName(fileName)) return fileName;
  }

  return documents
    .map((document) => ({
      fileName: document.match(/<FILENAME>\s*([^\s<]+)/i)?.[1]?.trim(),
      isFormDXml: /<(?:[\w.-]+:)?edgarSubmission\b/i.test(document)
    }))
    .find((document) => document.isFormDXml && document.fileName && isXmlFileName(document.fileName))?.fileName;
}

function siblingDocumentUrl(archivesBaseUrl: string, submissionFileName: string, primaryFileName: string) {
  const normalizedSubmission = submissionFileName.replace(/\\/g, "/");
  const directory = normalizedSubmission.slice(0, normalizedSubmission.lastIndexOf("/") + 1);
  return documentUrl(archivesBaseUrl, `${directory}${primaryFileName.replace(/^\/+/, "")}`);
}

function requestHeaders(userAgent: string) {
  return {
    accept: "text/plain,application/xml,text/xml;q=0.9,*/*;q=0.1",
    "user-agent": userAgent
  };
}

async function waitForNextSecBatch() {
  await new Promise<void>((resolve) => setTimeout(resolve, SEC_BATCH_DELAY_MS));
}

async function mapSecBatches<T, U>(items: T[], task: (item: T) => Promise<U>) {
  const results: U[] = [];
  for (let index = 0; index < items.length; index += SEC_BATCH_SIZE) {
    results.push(...(await Promise.all(items.slice(index, index + SEC_BATCH_SIZE).map(task))));
    if (index + SEC_BATCH_SIZE < items.length) await waitForNextSecBatch();
  }
  return results;
}

export function parseSecFormDIndex(indexText: string): SecFormDIndexEntry[] {
  const filings: SecFormDIndexEntry[] = [];
  for (const rawLine of indexText.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const pipeColumns = line.split("|").map((column) => column.trim());
    const fixedColumns = line.match(/^(D(?:\/A)?)\s+(.+?)\s+(\d{1,10})\s+(\d{4}-\d{2}-\d{2})\s+(.+)$/);
    const form = pipeColumns.length === 5 ? pipeColumns[2] : fixedColumns?.[1];
    if (form !== "D" && form !== "D/A") continue;
    const companyName = pipeColumns.length === 5 ? pipeColumns[1] : fixedColumns?.[2];
    const cik = normalizeCik(pipeColumns.length === 5 ? pipeColumns[0] : fixedColumns?.[3] ?? "");
    const filingDate = pipeColumns.length === 5 ? pipeColumns[3] : fixedColumns?.[4];
    const fileName = pipeColumns.length === 5 ? pipeColumns[4] : fixedColumns?.[5];
    const accessionNumber = fileName ? accessionFromFileName(fileName) : undefined;
    if (!companyName || !cik || !filingDate || !fileName || !accessionNumber) continue;
    filings.push({ accessionNumber, cik, companyName, filingDate, fileName, form });
  }
  return filings;
}

export function parseSecFormDXml(xml: string, metadata: SecFormDMetadata): RawSignal {
  const issuer = xmlSection(xml, "primaryIssuer") ?? xml;
  const offering = xmlSection(xml, "offeringData") ?? xml;
  const issuerName = xmlText(issuer, "entityName", "issuerName") ?? metadata.companyName ?? "Unknown Form D issuer";
  const issuerAddress = compactAddress(issuer, "issuerAddress");
  const offeringAmountUsd = xmlAmount(offering, "totalOfferingAmount");
  const amountSoldUsd = xmlAmount(offering, "totalAmountSold");
  const remainingAmountUsd = xmlAmount(offering, "totalRemaining");
  const isAmendment = metadata.form === "D/A";
  const hasOfferingAmount = [offeringAmountUsd, amountSoldUsd, remainingAmountUsd].some(
    (amount) => amount !== undefined && amount > 0
  );
  const priority = isAmendment || !hasOfferingAmount ? "low" : "medium";

  return {
    layer: "cash",
    source: "sec-form-d",
    externalId: metadata.accessionNumber,
    observedAt: observedAt(metadata.filingDate),
    confidence: isAmendment ? 0.56 : hasOfferingAmount ? 0.7 : 0.5,
    freshness: 1,
    sourceRefs: [
      {
        sourceId: "sec-form-d",
        url: metadata.sourceUrl,
        title: `${issuerName} ${metadata.form ?? "D"} ${metadata.accessionNumber}`,
        externalId: metadata.accessionNumber,
        observedAt: observedAt(metadata.filingDate)
      }
    ],
    payload: {
      accessionNumber: metadata.accessionNumber,
      amountSoldUsd,
      classification: "capital_raise_candidate",
      companyName: issuerName,
      cik: normalizeCik(xmlText(issuer, "cik") ?? metadata.cik),
      entityType: xmlText(issuer, "entityType"),
      evidenceScope: "single_sec_form_d_filing",
      filingDate: metadata.filingDate,
      firstSaleDate: xmlText(offering, "dateOfFirstSale") ?? xmlText(xml, "dateOfFirstSale"),
      form: metadata.form ?? "D",
      industry: xmlText(offering, "industryGroupType", "industryGroup"),
      isAmendment,
      issuer: {
        ...(issuerAddress ? { address: issuerAddress } : {}),
        entityType: xmlText(issuer, "entityType"),
        name: issuerName
      },
      issuerAddress,
      issuerName,
      offeringAmountUsd,
      physicalInvestmentStatus: "not_proven",
      priority,
      relatedPeople: relatedPeople(xml),
      remainingAmountUsd,
      sourceIndexUrl: metadata.indexUrl,
      sourceUrl: metadata.sourceUrl
    }
  } satisfies RawSignal;
}

const fixtureXml = `
<edgarSubmission>
  <primaryIssuer>
    <cik>0001999999</cik>
    <entityName>Fixture Capital Raise LLC</entityName>
    <entityType>Limited Liability Company</entityType>
    <issuerAddress><street1>100 Example Way</street1><city>Austin</city><stateOrCountry>TX</stateOrCountry><zipCode>78701</zipCode></issuerAddress>
  </primaryIssuer>
  <relatedPersonsList><relatedPersonInfo><relatedPersonName><firstName>Ada</firstName><lastName>Lovelace</lastName></relatedPersonName></relatedPersonInfo></relatedPersonsList>
  <offeringData>
    <industryGroup><industryGroupType>Other Technology</industryGroupType></industryGroup>
    <dateOfFirstSale><value>2026-05-20</value></dateOfFirstSale>
    <offeringSalesAmounts><totalOfferingAmount>25000000</totalOfferingAmount><totalAmountSold>7500000</totalAmountSold><totalRemaining>17500000</totalRemaining></offeringSalesAmounts>
  </offeringData>
</edgarSubmission>`;

export async function fetchSecFormDSignals(options: SecFormDOptions = {}): Promise<RawSignal[]> {
  if (options.dryRun) {
    return [
      parseSecFormDXml(fixtureXml, {
        accessionNumber: "0001999999-26-000001",
        cik: "0001999999",
        companyName: "Fixture Capital Raise LLC",
        filingDate: "2026-05-20",
        sourceUrl: "https://www.sec.gov/Archives/edgar/data/1999999/000199999926000001/primary_doc.xml"
      })
    ];
  }
  if (!options.userAgent) throw new Error("SEC_EDGAR_USER_AGENT is required for SEC Form D requests");

  const fetchImpl = options.fetchImpl ?? fetch;
  const archivesBaseUrl = options.archivesBaseUrl ?? DEFAULT_ARCHIVES_BASE_URL;
  const dailyIndexBaseUrl = options.dailyIndexBaseUrl ?? DEFAULT_DAILY_INDEX_BASE_URL;
  const requestedLookbackDays = Number(options.indexLookbackDays ?? DEFAULT_INDEX_LOOKBACK_DAYS);
  const indexLookbackDays = Math.max(
    1,
    Math.min(
      MAX_INDEX_LOOKBACK_DAYS,
      Number.isFinite(requestedLookbackDays)
        ? Math.floor(requestedLookbackDays)
        : DEFAULT_INDEX_LOOKBACK_DAYS
    )
  );
  const limit = Math.max(1, options.limit ?? 50);
  const startDate = dateForIndex(options.now);
  const indexUrls = Array.from({ length: indexLookbackDays }, (_, offset) => {
    const date = new Date(startDate);
    date.setUTCDate(startDate.getUTCDate() - offset);
    return dailyIndexUrl(dailyIndexBaseUrl, date);
  });
  const headers = requestHeaders(options.userAgent);

  const indexed = await mapSecBatches(indexUrls, async (indexUrl): Promise<IndexedFiling[]> => {
    const response = await fetchWithTimeout(fetchImpl, indexUrl, { headers });
    if (response.status === 404) return [];
    if (!response.ok) throw new Error(`SEC Form D index request failed: ${response.status}`);
    return parseSecFormDIndex(await response.text()).map((entry) => ({ ...entry, indexUrl }));
  });
  const filings = indexed.flat().slice(0, limit);
  if (!filings.length) {
    // Preserve the shared SEC pacing even when this index window contains no Form D rows.
    await waitForNextSecBatch();
    return [];
  }

  // The daily form index references a submission text file. Resolve its declared Form D XML
  // document, then fetch that primary XML on a separate SEC-scheduled pass.
  await waitForNextSecBatch();
  const prepared = (
    await mapSecBatches(filings, async (filing): Promise<PreparedFiling | undefined> => {
      const submissionUrl = documentUrl(archivesBaseUrl, filing.fileName);
      const response = await fetchWithTimeout(fetchImpl, submissionUrl, { headers });
      if (response.status === 404) return undefined;
      if (!response.ok) throw new Error(`SEC Form D submission request failed: ${response.status}`);
      const document = await response.text();
      if (isXmlFileName(filing.fileName)) {
        return { filing, sourceUrl: submissionUrl, xml: document };
      }
      const primaryFileName = primaryXmlFileName(document, filing.form);
      if (!primaryFileName) return undefined;
      return {
        filing,
        sourceUrl: siblingDocumentUrl(archivesBaseUrl, filing.fileName, primaryFileName),
        primaryUrl: siblingDocumentUrl(archivesBaseUrl, filing.fileName, primaryFileName)
      };
    })
  ).filter((filing): filing is PreparedFiling => filing !== undefined);

  const primaryDocuments = prepared.filter((filing) => filing.primaryUrl);
  if (primaryDocuments.length) {
    await waitForNextSecBatch();
    await mapSecBatches(primaryDocuments, async (filing) => {
      const response = await fetchWithTimeout(fetchImpl, filing.primaryUrl!, { headers });
      if (response.status === 404) return;
      if (!response.ok) throw new Error(`SEC Form D primary XML request failed: ${response.status}`);
      filing.xml = await response.text();
    });
  }

  await waitForNextSecBatch();
  return prepared
    .filter((filing): filing is PreparedFiling & { xml: string } => Boolean(filing.xml))
    .filter((filing) => /<(?:[\w.-]+:)?edgarSubmission\b/i.test(filing.xml))
    .map((filing) => parseSecFormDXml(filing.xml, { ...filing.filing, sourceUrl: filing.sourceUrl }));
}
