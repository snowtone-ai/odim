import type { SourceRef } from "../../pipeline/types.ts";
import type { CascadeEvidence } from "../cascade.ts";
import { tokenize as tokenizeMunin } from "../../munin/memory.ts";
import type { HuginnClaimCitation, HuginnGrounding } from "./types.ts";

// A single generic word such as "evidence" or "current" is not provenance.
// Keep this deliberately small and conservative: words outside the set still
// need corroboration from a second meaningful overlap.
const citationStopwords = new Set([
  "about", "after", "answer", "before", "could", "current", "data", "does", "evidence", "from", "have", "into", "more", "must", "only", "other", "source", "sources", "that", "their", "there", "these", "this", "those", "under", "with", "would",
  "ため", "これ", "それ", "こと", "もの", "情報", "証拠", "現在", "回答", "出典", "対象", "関連", "可能", "確認", "支持", "結論", "では", "ない", "ます", "です", "から", "まで", "よう", "ある", "いる", "する", "した", "して", "など", "およ", "及び"
]);

const positivePolarity = /\b(?:increase|increased|increasing|approval|approved|approve|accepted|acceptance|positive|confirmed|active|true|up)\b|増加|増え|増強|承認|肯定|確認済み|上昇/giu;
const negativePolarity = /\b(?:decrease|decreased|decreasing|rejected|reject|unapproved|unconfirmed|disapproval|negative|denied|inactive|false|down)\b|減少|減り|拒否|却下|不承認|低下|否定/giu;
const englishNegation = /(?:\b(?:not|never|no|without|isn't|wasn't|aren't|weren't|don't|doesn't|didn't)\b\s*)$/iu;
const japaneseNegationAfter = /^(?:されてい|してい|では|で|され|し|が|は)?(?:ない|ません|なかった|ず|ぬ)/u;
const japaneseNegationBefore = /(?:未|不|非)$/u;

function meaningfulTokens(value: string) {
  // Muninn's tokenizer keeps English words intact and emits CJK/Kana 2-grams
  // for no-whitespace text, so citations follow retrieval's language model.
  return [...tokenizeMunin(value)].filter((token) => !citationStopwords.has(token));
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function isAsOf(ref: SourceRef, asOf: string) {
  const observedAt = Date.parse(ref.observedAt ?? "");
  const limit = Date.parse(asOf);
  return Number.isFinite(observedAt) && Number.isFinite(limit) && observedAt <= limit;
}

type Polarity = "positive" | "negative";

/**
 * Detect polarity at marker level, including the common negated forms. The
 * previous implementation used boolean regexes, so `not approved` was read
 * as positive and could be cited by an approved claim. Ambiguous text that
 * contains both directions is intentionally treated as unsafe to cite.
 */
function polarityOf(value: string) {
  const normalized = value.toLocaleLowerCase();
  const result = new Set<Polarity>();
  const collect = (pattern: RegExp, polarity: Polarity) => {
    pattern.lastIndex = 0;
    for (const match of normalized.matchAll(pattern)) {
      const index = match.index ?? 0;
      const marker = match[0] ?? "";
      const before = normalized.slice(Math.max(0, index - 32), index);
      const after = normalized.slice(index + marker.length, index + marker.length + 16);
      const negated = englishNegation.test(before) || japaneseNegationBefore.test(before) || japaneseNegationAfter.test(after);
      result.add(negated ? (polarity === "positive" ? "negative" : "positive") : polarity);
    }
  };
  collect(positivePolarity, "positive");
  collect(negativePolarity, "negative");
  return result;
}

function hasPolarityConflict(claim: string, evidence: string) {
  const claimPolarity = polarityOf(claim);
  const evidencePolarity = polarityOf(evidence);
  // A claim/evidence pair containing both directions is semantically
  // ambiguous even when one direction happens to overlap lexically.
  if (claimPolarity.size > 1 || evidencePolarity.size > 1) return true;
  return (
    (claimPolarity.has("positive") && evidencePolarity.has("negative")) ||
    (claimPolarity.has("negative") && evidencePolarity.has("positive"))
  );
}

function answerClaims(answer: string) {
  const claims = answer
    .split(/(?:[。！？!?]+|\n+)/u)
    .map((part) => part.trim())
    .filter((part) => part.length >= 12)
    .slice(0, 8);
  return claims.length ? claims : answer.trim() ? [answer.trim().slice(0, 360)] : [];
}

/**
 * Deterministic, conservative claim ledger. A source is attached only when a
 * non-narrative evidence item has an as-of-valid reference and either names
 * that source explicitly or has two meaningful lexical overlaps covering a
 * material part of the claim. This deliberately prefers partial/abstain over
 * invented provenance while the temporal Muninn API is rolling out.
 */
export function buildClaimCitationLedger(input: { answer: string; evidence: CascadeEvidence[]; asOf: string }) {
  const candidates = input.evidence
    .filter((item) => !item.isNarrative)
    .map((item) => ({
      item,
      references: item.sourceRefs.filter((ref) => isAsOf(ref, input.asOf)),
      stale: item.sourceRefs.length > 0 && item.sourceRefs.every((ref) => !isAsOf(ref, input.asOf)),
      tokens: meaningfulTokens(item.content)
    }));
  const claims = answerClaims(input.answer);
  const ledger: HuginnClaimCitation[] = claims.map((claim, index) => {
    const claimTokens = meaningfulTokens(claim);
    const matches = candidates.filter(({ item, tokens, references }) => {
      if (!references.length) return false;
      // Shared words are not enough when the evidence asserts the opposite
      // direction (e.g. approved vs rejected, increase vs decrease).
      if (hasPolarityConflict(claim, item.content)) return false;
      const shared = claimTokens.filter((token) => tokens.includes(token));
      const lexicalCoverage = shared.length / Math.max(1, claimTokens.length);
      const explicitSourceId = references.some((ref) => {
        const sourceId = ref.sourceId.toLocaleLowerCase();
        return sourceId.length >= 4 && claim.toLocaleLowerCase().includes(sourceId);
      });
      return explicitSourceId || (shared.length >= 2 && lexicalCoverage >= 0.3);
    });
    const sourceIds = unique(matches.flatMap(({ references }) => references.map((ref) => ref.sourceId)));
    const stale = !sourceIds.length && candidates.some((candidate) => {
      if (!candidate.stale) return false;
      if (hasPolarityConflict(claim, candidate.item.content)) return false;
      const shared = claimTokens.filter((token) => candidate.tokens.includes(token));
      return shared.length >= 2 && shared.length / Math.max(1, claimTokens.length) >= 0.3;
    });
    return {
      claimId: `claim-${index + 1}`,
      claim,
      sourceIds,
      status: sourceIds.length ? "cited" : stale ? "stale" : "uncited"
    };
  });
  const citedClaims = ledger.filter((claim) => claim.status === "cited").length;
  const staleClaims = ledger.filter((claim) => claim.status === "stale").length;
  const citationCoverage = claims.length ? Math.round((citedClaims / claims.length) * 100) / 100 : 0;
  const grounding: HuginnGrounding = {
    status: staleClaims ? "stale" : citedClaims === 0 ? "insufficient" : citedClaims === claims.length ? "grounded" : "partial",
    asOf: input.asOf,
    citedClaims,
    totalClaims: claims.length,
    citationCoverage,
    reason: staleClaims ? "stale_citations" : citedClaims === 0 ? "missing_citations" : citedClaims === claims.length ? undefined : "partial_citations"
  };
  return { ledger, grounding };
}
