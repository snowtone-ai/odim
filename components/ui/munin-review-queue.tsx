"use client";

import { useMemo, useState } from "react";
import { listMuninReviewProposals, reviewMuninProposal } from "@/app/actions/munin";
import type { MuninMemoryProposal } from "@/lib/munin/proposals";

type Decision = "approve" | "reject";

function formatDate(value: string | null | undefined, locale: "en" | "ja") {
  if (!value) return locale === "ja" ? "記録なし" : "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value.slice(0, 10);
  return new Intl.DateTimeFormat(locale === "ja" ? "ja-JP" : "en-US", {
    dateStyle: "medium",
    timeZone: "UTC"
  }).format(date);
}

function sourceLabel(proposal: MuninMemoryProposal) {
  const firstSource = proposal.sourceRefs[0];
  return firstSource?.title || firstSource?.sourceId || proposal.sourceType.replaceAll("_", " ");
}

export function MuninReviewQueue({
  initialProposals,
  initialError,
  locale = "en"
}: Readonly<{
  initialProposals: MuninMemoryProposal[];
  initialError?: string;
  locale?: "en" | "ja";
}>) {
  const [proposals, setProposals] = useState(initialProposals.filter((proposal) => proposal.reviewStatus === "pending_review"));
  const [busy, setBusy] = useState<{ id: string; decision: Decision } | null>(null);
  const [loadError, setLoadError] = useState(initialError ?? "");
  const [feedback, setFeedback] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const pendingCount = useMemo(() => proposals.length, [proposals]);

  const copy = locale === "ja"
    ? {
        title: "Munin レビューキュー",
        pending: "承認待ち",
        empty: "レビュー待ちの提案はありません。",
        error: "レビューキューを読み込めませんでした。",
        retry: "再試行",
        refresh: "更新",
        relevance: "関連度",
        reviewGate: "レビューゲート",
        source: "出典",
        asOf: "基準時点",
        pendingReview: "承認待ち",
        approve: "承認",
        reject: "却下",
        approving: "承認中…",
        rejecting: "却下中…",
        approved: "提案を承認しました。",
        rejected: "提案を却下しました。",
        failed: "変更を保存できませんでした。",
        sourceHash: "出典ハッシュ"
      }
    : {
        title: "Munin review queue",
        pending: "pending",
        empty: "No proposals are waiting for review.",
        error: "The review queue could not be loaded.",
        retry: "Retry",
        refresh: "Refresh",
        relevance: "Relevance",
        reviewGate: "Review gate",
        source: "Source",
        asOf: "As of",
        pendingReview: "Pending review",
        approve: "Approve",
        reject: "Reject",
        approving: "Approving…",
        rejecting: "Rejecting…",
        approved: "Proposal approved.",
        rejected: "Proposal rejected.",
        failed: "The decision could not be saved.",
        sourceHash: "Source hash"
      };

  async function refreshQueue() {
    setRefreshing(true);
    setLoadError("");
    try {
      // The browser never supplies org authority. This action resolves the
      // signed SSO session (or the explicit local fixture context) server-side.
      const result = await listMuninReviewProposals();
      if (!result.ok) throw new Error(result.error || copy.error);
      setProposals(result.proposals.filter((proposal) => proposal.reviewStatus === "pending_review"));
      setFeedback("");
    } catch {
      setLoadError(copy.error);
      setFeedback(copy.failed);
    } finally {
      setRefreshing(false);
    }
  }

  async function decide(proposal: MuninMemoryProposal, decision: Decision) {
    setBusy({ id: proposal.id, decision });
    setFeedback("");
    try {
      const result = await reviewMuninProposal(proposal.id, decision);
      if (!result.ok) throw new Error(result.error || copy.failed);
      setProposals((current) => current.filter((item) => item.id !== proposal.id));
      setFeedback(decision === "approve" ? copy.approved : copy.rejected);
    } catch {
      setFeedback(copy.failed);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="min-w-0" aria-busy={refreshing || busy !== null}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="mono text-[12px] uppercase tracking-[0.12em]" style={{ color: "var(--text-tertiary)" }}>
          {pendingCount} {copy.pending}
        </div>
        <button
          type="button"
          onClick={refreshQueue}
          disabled={refreshing}
          className="inline-flex min-h-11 items-center border px-3 text-[12px] transition-colors duration-[120ms] hover:bg-[var(--surface-hover)] focus-visible:outline-2 focus-visible:outline-[var(--signal)] disabled:cursor-wait disabled:opacity-60 motion-reduce:transition-none"
          style={{ borderColor: "var(--line-soft)", color: "var(--text-secondary)" }}
        >
          {refreshing ? "…" : copy.refresh}
        </button>
      </div>

      <div className="min-h-6 text-[12px]" aria-live="polite" role="status" style={{ color: loadError ? "var(--critical)" : "var(--signal)" }}>
        {loadError ? (
          <span className="flex flex-wrap items-center gap-3">
            <span>{copy.error}</span>
            <button
              type="button"
              onClick={refreshQueue}
              className="inline-flex min-h-11 items-center underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-[var(--signal)]"
            >
              {copy.retry}
            </button>
          </span>
        ) : feedback ? feedback : null}
      </div>

      {!loadError && proposals.length === 0 ? (
        <div className="border-y py-6 text-[13px]" style={{ borderColor: "var(--line-soft)", color: "var(--text-secondary)" }}>
          {copy.empty}
        </div>
      ) : null}

      {!loadError && proposals.length > 0 ? (
        <div className="border-y" style={{ borderColor: "var(--line-soft)" }}>
          {proposals.map((proposal) => {
            const rowBusy = busy?.id === proposal.id;
            const approveBusy = rowBusy && busy?.decision === "approve";
            const rejectBusy = rowBusy && busy?.decision === "reject";
            return (
              <article
                key={proposal.id}
                className="grid gap-4 border-b py-4 last:border-b-0 lg:grid-cols-[minmax(0,1fr)_minmax(220px,0.6fr)_auto] lg:items-start"
                style={{ borderColor: "var(--line-faint)" }}
              >
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="mono text-[11px] uppercase tracking-[0.11em]" style={{ color: "var(--signal)" }}>
                      {copy.pendingReview}
                    </span>
                    <span className="mono text-[11px] uppercase tracking-[0.1em]" style={{ color: "var(--text-tertiary)" }}>
                      {proposal.memoryClass}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed" style={{ color: "var(--text-primary)" }}>
                    {proposal.content}
                  </p>
                  <p className="mono mt-2 truncate text-[11px]" title={proposal.sourceHash} style={{ color: "var(--text-tertiary)" }}>
                    {copy.sourceHash}: {proposal.sourceHash.slice(0, 16)}…
                  </p>
                </div>

                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[12px]">
                  <div>
                    <dt className="mono text-[11px] uppercase tracking-[0.09em]" style={{ color: "var(--text-tertiary)" }}>{copy.relevance}</dt>
                    <dd className="mt-0.5" style={{ color: "var(--text-primary)" }}>{Math.round(proposal.salienceScore * 100)}%</dd>
                  </div>
                  <div>
                    <dt className="mono text-[11px] uppercase tracking-[0.09em]" style={{ color: "var(--text-tertiary)" }}>{copy.reviewGate}</dt>
                    <dd className="mt-0.5" style={{ color: "var(--text-primary)" }}>{copy.pendingReview}</dd>
                  </div>
                  <div>
                    <dt className="mono text-[11px] uppercase tracking-[0.09em]" style={{ color: "var(--text-tertiary)" }}>{copy.source}</dt>
                    <dd className="mt-0.5 truncate" title={sourceLabel(proposal)} style={{ color: "var(--text-primary)" }}>{sourceLabel(proposal)}</dd>
                  </div>
                  <div>
                    <dt className="mono text-[11px] uppercase tracking-[0.09em]" style={{ color: "var(--text-tertiary)" }}>{copy.asOf}</dt>
                    <dd className="mt-0.5" style={{ color: "var(--text-primary)" }}>{formatDate(proposal.observedAt, locale)}</dd>
                  </div>
                </dl>

                <div className="flex flex-wrap gap-2 lg:justify-end">
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => decide(proposal, "approve")}
                    className="inline-flex min-h-11 items-center justify-center border px-3 text-[12px] transition-colors duration-[120ms] hover:bg-[var(--signal-wash)] focus-visible:outline-2 focus-visible:outline-[var(--signal)] disabled:cursor-wait disabled:opacity-60 motion-reduce:transition-none"
                    style={{ borderColor: "var(--signal)", color: "var(--signal)" }}
                  >
                    {approveBusy ? copy.approving : copy.approve}
                  </button>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => decide(proposal, "reject")}
                    className="inline-flex min-h-11 items-center justify-center border px-3 text-[12px] transition-colors duration-[120ms] hover:bg-[var(--surface-hover)] focus-visible:outline-2 focus-visible:outline-[var(--signal)] disabled:cursor-wait disabled:opacity-60 motion-reduce:transition-none"
                    style={{ borderColor: "var(--line-soft)", color: "var(--text-secondary)" }}
                  >
                    {rejectBusy ? copy.rejecting : copy.reject}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
