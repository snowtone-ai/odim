"use server";

import {
  listPendingMemoryProposals,
  reviewMemoryProposal,
  type MuninMemoryProposal
} from "@/lib/munin/proposals";
import { getMuninReviewContext } from "@/lib/munin/review-auth";

type ReviewActionResult =
  | { ok: true; orgId: string; proposals: MuninMemoryProposal[] }
  | { ok: false; error: string };

function safeError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : "";
  if (/unauthorized/i.test(message)) return "Sign in with an authorized organization session.";
  if (/no longer pending/i.test(message)) return "Proposal was already reviewed.";
  if (/not found/i.test(message)) return "Proposal not found.";
  return fallback;
}

export async function listMuninReviewProposals(): Promise<ReviewActionResult> {
  try {
    const context = await getMuninReviewContext();
    return {
      ok: true,
      orgId: context.orgId,
      proposals: await listPendingMemoryProposals(context.orgId)
    };
  } catch (error) {
    return { ok: false, error: safeError(error, "Unable to load the review queue.") };
  }
}

export async function reviewMuninProposal(
  proposalId: string,
  decision: "approve" | "reject",
  note?: string
): Promise<
  | { ok: true; orgId: string; proposal: MuninMemoryProposal; applied: boolean }
  | { ok: false; error: string }
> {
  try {
    if (!/^[a-zA-Z0-9:_-]{1,128}$/.test(proposalId.trim())) throw new Error("invalid proposal id");
    const context = await getMuninReviewContext();
    const result = await reviewMemoryProposal({
      orgId: context.orgId,
      proposalId: proposalId.trim(),
      decision,
      reviewerId: context.userId ?? context.principal,
      note: typeof note === "string" && note.trim() ? note.trim().slice(0, 2_000) : undefined
    });
    return { ok: true, orgId: context.orgId, proposal: result.proposal, applied: result.applied };
  } catch (error) {
    return { ok: false, error: safeError(error, "Unable to apply the review decision.") };
  }
}
