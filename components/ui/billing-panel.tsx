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
      <div className="grid gap-2.5">
        <div className="flex items-center justify-between text-[13px]">
          <span style={{ color: "var(--text-secondary)" }}>{labels.currentPlan}</span>
          <span className="mono" style={{ color: "var(--rune)" }}>{labels.planNames[plan]}</span>
        </div>
        <div className="flex items-center justify-between text-[13px]">
          <span style={{ color: "var(--text-secondary)" }}>{labels.status}</span>
          <span className="flex items-center gap-2">
            <span
              className="inline-block rounded-full"
              style={{
                width: 8,
                height: 8,
                background: healthy ? "var(--positive, #22c55e)" : "var(--critical)"
              }}
            />
            <span className="mono text-[12px]" style={{ color: "var(--text-primary)" }}>
              {labels.statusNames[statusLabelKey[status]]}
            </span>
          </span>
        </div>
        {periodEnd ? (
          <div className="flex items-center justify-between text-[13px]">
            <span style={{ color: "var(--text-secondary)" }}>{labels.periodEnd}</span>
            <span className="mono text-[12px]" style={{ color: "var(--text-primary)" }}>{periodEnd.slice(0, 10)}</span>
          </div>
        ) : null}
      </div>

      {billingEnabled ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {plan !== "pro" && plan !== "enterprise" ? (
            <button
              type="button"
              onClick={() => startCheckout("pro")}
              disabled={pendingPlan !== null}
              className="mono text-[10px] uppercase tracking-[0.1em] px-3 py-1.5 rounded transition-colors hover:brightness-110"
              style={{
                background: "rgba(201,169,97,0.1)",
                border: "1px solid rgba(201,169,97,0.25)",
                color: "var(--rune)"
              }}
            >
              {pendingPlan === "pro" ? "…" : labels.upgradePro}
            </button>
          ) : null}
          {plan !== "enterprise" ? (
            <button
              type="button"
              onClick={() => startCheckout("enterprise")}
              disabled={pendingPlan !== null}
              className="mono text-[10px] uppercase tracking-[0.1em] px-3 py-1.5 rounded transition-colors hover:brightness-110"
              style={{
                background: "rgba(201,169,97,0.1)",
                border: "1px solid rgba(201,169,97,0.25)",
                color: "var(--rune)"
              }}
            >
              {pendingPlan === "enterprise" ? "…" : labels.upgradeEnterprise}
            </button>
          ) : null}
          {failed ? (
            <span className="mono text-[10px] uppercase tracking-[0.1em]" style={{ color: "var(--critical)" }}>
              {labels.checkoutFailed}
            </span>
          ) : null}
        </div>
      ) : (
        <div className="mono mt-4 text-[10px] uppercase tracking-[0.11em]" style={{ color: "var(--text-tertiary)" }}>
          {labels.notEnabled}
        </div>
      )}
    </div>
  );
}
