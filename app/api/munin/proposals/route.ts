import { NextResponse } from "next/server";
import { authorizeApiRequest } from "@/lib/auth/request";
import {
  listPendingMemoryProposals,
  reviewMemoryProposal,
  type MuninMemoryProposal
} from "@/lib/munin/proposals";

const proposalIdPattern = /^[a-zA-Z0-9:_-]{1,128}$/;

function publicProposal(proposal: MuninMemoryProposal) {
  return {
    id: proposal.id,
    orgId: proposal.orgId,
    runId: proposal.runId,
    content: proposal.content,
    sourceType: proposal.sourceType,
    memoryClass: proposal.memoryClass,
    agentScope: proposal.agentScope,
    sourceRefs: proposal.sourceRefs,
    salienceScore: proposal.salienceScore,
    memoryStatus: proposal.memoryStatus,
    reviewStatus: proposal.reviewStatus,
    sourceHash: proposal.sourceHash,
    observedAt: proposal.observedAt,
    ingestedAt: proposal.ingestedAt,
    supersedes: proposal.supersedes,
    parentMemoryIds: proposal.parentMemoryIds,
    provenance: proposal.provenance,
    createdAt: proposal.createdAt,
    reviewedAt: proposal.reviewedAt,
    reviewedBy: proposal.reviewedBy,
    reviewNote: proposal.reviewNote
  };
}

export async function GET(request: Request) {
  try {
    const auth = await authorizeApiRequest(request, "admin:read");
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
    if (!auth.context.orgId) return NextResponse.json({ error: "Organization scope is required" }, { status: 400 });

    const proposals = await listPendingMemoryProposals(auth.context.orgId);
    return NextResponse.json({ proposals: proposals.map(publicProposal) });
  } catch (error) {
    console.error("munin proposals GET failed", {
      errorType: error instanceof Error ? error.name : typeof error
    });
    return NextResponse.json({ error: "Unable to load the review queue" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await authorizeApiRequest(request, "admin:write");
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
    if (!auth.context.orgId) return NextResponse.json({ error: "Organization scope is required" }, { status: 400 });

    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    const proposalId = typeof body?.proposalId === "string" ? body.proposalId.trim() : "";
    const decision = body?.decision;
    const note = body?.note;
    if (!proposalIdPattern.test(proposalId)) {
      return NextResponse.json({ error: "A valid proposalId is required" }, { status: 400 });
    }
    if (decision !== "approve" && decision !== "reject") {
      return NextResponse.json({ error: "decision must be approve or reject" }, { status: 400 });
    }
    if (note !== undefined && (typeof note !== "string" || note.length > 2_000)) {
      return NextResponse.json({ error: "note must be a string of 2,000 characters or fewer" }, { status: 400 });
    }

    // In protected mode this is the API-key owner. Disabled/local mode uses a
    // fixed service actor; a client header is never treated as identity.
    const reviewerId = auth.context.userId ?? `odim-admin:${auth.mode}`;
    const normalizedNote = typeof note === "string" ? note.trim().slice(0, 2_000) : undefined;
    const result = await reviewMemoryProposal({
      orgId: auth.context.orgId,
      proposalId,
      decision,
      reviewerId: reviewerId.slice(0, 160),
      note: normalizedNote
    });
    return NextResponse.json({ proposal: publicProposal(result.proposal), applied: result.applied });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/not found/i.test(message)) {
      return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
    }
    if (/no longer pending/i.test(message)) {
      return NextResponse.json({ error: "Proposal was already reviewed" }, { status: 409 });
    }
    console.error("munin proposals POST failed", {
      errorType: error instanceof Error ? error.name : typeof error
    });
    return NextResponse.json({ error: "Unable to apply the review decision" }, { status: 500 });
  }
}
