"use client";

import { useState } from "react";

type BillingLabels = {
  currentPlan: string;
  status: string;
  periodEnd: string;
  upgradePro: string;
  upgradeEnterprise: string;
  notEnabled: string;
  checkoutFailed: string;
  planNames: { trial: string; pro: string; enterprise: string };
  statusNames: { trialing: string; active: string; pastDue: string; canceled: string };
};

type PlanId = "trial" | "pro" | "enterprise";
type BillingStatus = "trialing" | "active" | "past_due" | "canceled";

const statusLabelKey: Record<BillingStatus, keyof BillingLabels["statusNames"]> = {
  trialing: "trialing",
  active: "active",
  past_due: "pastDue",
  canceled: "canceled"
};

export function BillingPanel({
  plan,
  status,
  periodEnd,
  billingEnabled,
  labels
}: Readonly<{
  plan: PlanId;
  status: BillingStatus;
  periodEnd?: string;
  billingEnabled: boolean;
  labels: BillingLabels;
}>) {
  const [pendingPlan, setPendingPlan] = useState<PlanId | null>(null);
  const [failed, setFailed] = useState(false);

  async function startCheckout(target: Exclude<PlanId, "trial">) {
    setPendingPlan(target);
    setFailed(false);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: target })
      });
      const body = (await res.json().catch(() => ({}))) as { url?: string };
      if (!res.ok || !body.url) throw new Error("checkout failed");
      window.location.assign(body.url);
    } catch {
      setFailed(true);
      setPendingPlan(null);
    }
  }

  const healthy = status === "active" || status === "trialing";

  return (
    <div>
      <div className="border-y" style={{ borderColor: "var(--line-soft)" }}>
        <div className="flex min-h-11 items-center justify-between gap-4 border-b px-3 text-[13px]" style={{ borderColor: "var(--line-faint)" }}>
          <span style={{ color: "var(--text-secondary)" }}>{labels.currentPlan}</span>
          <span className="mono" style={{ color: "var(--signal)" }}>{labels.planNames[plan]}</span>
        </div>
        <div className="flex min-h-11 items-center justify-between gap-4 border-b px-3 text-[13px]" style={{ borderColor: "var(--line-faint)" }}>
          <span style={{ color: "var(--text-secondary)" }}>{labels.status}</span>
          <span className="flex items-center gap-2">
            <span className="inline-block h-2 w-2" aria-hidden="true" style={{ background: healthy ? "var(--positive)" : "var(--critical)" }} />
            <span className="mono text-[12px]" style={{ color: healthy ? "var(--positive)" : "var(--critical)" }}>{labels.statusNames[statusLabelKey[status]]}</span>
          </span>
        </div>
        {periodEnd ? (
          <div className="flex min-h-11 items-center justify-between gap-4 px-3 text-[13px]">
            <span style={{ color: "var(--text-secondary)" }}>{labels.periodEnd}</span>
            <span className="mono text-[12px]" style={{ color: "var(--text-primary)" }}>{periodEnd.slice(0, 10)}</span>
          </div>
        ) : null}
      </div>

      {billingEnabled ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {plan !== "pro" && plan !== "enterprise" ? (
            <button type="button" onClick={() => startCheckout("pro")} disabled={pendingPlan !== null} className="mono min-h-11 border px-3 text-[12px] uppercase tracking-[0.1em] transition-colors duration-[120ms] hover:bg-[var(--signal-wash)] focus-visible:outline-2 focus-visible:outline-[var(--signal)] disabled:opacity-45 motion-reduce:transition-none" style={{ background: "var(--signal-wash)", borderColor: "var(--signal)", color: "var(--signal)" }}>
              {pendingPlan === "pro" ? "…" : labels.upgradePro}
            </button>
          ) : null}
          {plan !== "enterprise" ? (
            <button type="button" onClick={() => startCheckout("enterprise")} disabled={pendingPlan !== null} className="mono min-h-11 border px-3 text-[12px] uppercase tracking-[0.1em] transition-colors duration-[120ms] hover:bg-[var(--signal-wash)] focus-visible:outline-2 focus-visible:outline-[var(--signal)] disabled:opacity-45 motion-reduce:transition-none" style={{ background: "transparent", borderColor: "var(--line-soft)", color: "var(--text-secondary)" }}>
              {pendingPlan === "enterprise" ? "…" : labels.upgradeEnterprise}
            </button>
          ) : null}
          {failed ? <span className="mono text-[12px] uppercase tracking-[0.1em]" aria-live="assertive" style={{ color: "var(--critical)" }}>{labels.checkoutFailed}</span> : null}
        </div>
      ) : (
        <div className="mono mt-4 text-[11px] uppercase tracking-[0.11em]" style={{ color: "var(--text-tertiary)" }}>{labels.notEnabled}</div>
      )}
    </div>
  );
}
