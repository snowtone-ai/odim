"use client";

import { useState } from "react";

const LAYER_OPTIONS = [
  { value: "any", label: "Any" },
  { value: "energy", label: "Energy" },
  { value: "cash", label: "Capital" },
  { value: "land", label: "Land" },
  { value: "compute", label: "Compute" },
  { value: "water", label: "Water" },
  { value: "raw_materials", label: "Raw Materials" },
  { value: "logistics", label: "Logistics" }
];

const PRIORITY_OPTIONS = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;
const DESTINATION_OPTIONS = [
  { value: "dashboard", label: "Dashboard" },
  { value: "slack", label: "Slack" },
  { value: "both", label: "Both" }
] as const;

type AlertRuleForm = {
  name: string;
  layer: string;
  minConfidence: number;
  priority: string;
  destination: string;
  enabled: boolean;
};

type Messages = {
  addRule: string;
  editRule: string;
  save: string;
  cancel: string;
  labelName: string;
  labelLayer: string;
  labelMinConf: string;
  labelPriority: string;
  labelDestination: string;
  labelEnabled: string;
  deleteRule: string;
};

type ExistingRule = {
  id: string;
  name: string;
  layer: string;
  minConfidence: number;
  destination: string;
  enabled: boolean;
};

const EMPTY_FORM: AlertRuleForm = {
  name: "",
  layer: "any",
  minConfidence: 80,
  priority: "HIGH",
  destination: "dashboard",
  enabled: true
};

const controlClass = "min-h-11 border bg-[var(--field)] px-3 text-[12px] text-[var(--text-primary)] outline-none transition-[background-color,border-color,color] duration-[var(--motion-micro)] focus-visible:ring-2 focus-visible:ring-[var(--signal)]";
const actionClass = "mono inline-flex min-h-11 items-center justify-center border px-3 text-[11px] uppercase tracking-[0.08em] transition-[background-color,border-color,color,transform] duration-[var(--motion-micro)] hover:bg-[var(--signal-wash)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--signal)] motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-50";

export function AlertRuleBuilder({
  initialRules,
  messages
}: Readonly<{
  initialRules: ExistingRule[];
  messages: Messages;
}>) {
  const [rules, setRules] = useState<ExistingRule[]>(initialRules);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AlertRuleForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");

  function openAdd() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(true);
    setError(null);
    setFeedback("");
  }

  function openEdit(rule: ExistingRule) {
    setForm({
      name: rule.name,
      layer: rule.layer,
      minConfidence: Math.round(rule.minConfidence * 100),
      priority: "HIGH",
      destination: rule.destination,
      enabled: rule.enabled
    });
    setEditingId(rule.id);
    setShowForm(true);
    setError(null);
    setFeedback("");
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setError(null);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      setError("Name is required");
      return;
    }
    setSaving(true);
    setError(null);
    setFeedback("");
    try {
      const payload = {
        name: form.name.trim(),
        layer: form.layer,
        minConfidence: form.minConfidence / 100,
        destination: form.destination,
        enabled: form.enabled
      };

      if (editingId) {
        const res = await fetch("/api/alert-rules?id=" + editingId, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error(await res.text());
        setRules((prev) => prev.map((rule) => rule.id === editingId ? { ...rule, ...payload } : rule));
        setFeedback("Rule updated");
      } else {
        const res = await fetch("/api/alert-rules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error(await res.text());
        const { rule } = await res.json() as { rule: ExistingRule };
        setRules((prev) => [rule, ...prev]);
        setFeedback("Rule added");
      }
      closeForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setPendingId(id);
    setError(null);
    try {
      const res = await fetch("/api/alert-rules?id=" + id, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      setRules((prev) => prev.filter((rule) => rule.id !== id));
      setFeedback("Rule deleted");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setPendingId(null);
    }
  }

  async function handleToggle(rule: ExistingRule) {
    setPendingId(rule.id);
    setError(null);
    try {
      const res = await fetch("/api/alert-rules?id=" + rule.id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !rule.enabled })
      });
      if (!res.ok) throw new Error(await res.text());
      setRules((prev) => prev.map((candidate) => candidate.id === rule.id ? { ...candidate, enabled: !candidate.enabled } : candidate));
      setFeedback(rule.enabled ? "Rule paused" : "Rule enabled");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Toggle failed");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div>
      <div className="divide-y border-y" style={{ borderColor: "var(--line-soft)" }}>
        {rules.length ? rules.map((rule) => (
          <div key={rule.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="truncate text-[13px]" style={{ color: rule.enabled ? "var(--text-primary)" : "var(--text-tertiary)" }}>{rule.name}</p>
              <p className="mono mt-1 text-[11px] uppercase tracking-[0.08em]" style={{ color: "var(--text-tertiary)" }}>
                {rule.layer} · {rule.destination} · {Math.round(rule.minConfidence * 100)}%
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                aria-pressed={rule.enabled}
                onClick={() => handleToggle(rule)}
                disabled={pendingId !== null}
                className={actionClass}
                style={{ borderColor: rule.enabled ? "var(--evidence)" : "var(--line-soft)", color: rule.enabled ? "var(--evidence)" : "var(--text-tertiary)" }}
              >
                {rule.enabled ? "On" : "Off"}
              </button>
              <button
                type="button"
                onClick={() => openEdit(rule)}
                disabled={pendingId !== null}
                className={actionClass}
                style={{ borderColor: "var(--line-soft)", color: "var(--text-tertiary)" }}
              >
                {messages.editRule}
              </button>
              <button
                type="button"
                onClick={() => handleDelete(rule.id)}
                disabled={pendingId !== null}
                className={actionClass}
                style={{ borderColor: "var(--line-soft)", color: "var(--critical)" }}
              >
                {messages.deleteRule}
              </button>
            </div>
          </div>
        )) : (
          <p role="status" className="py-5 text-[12px]" style={{ color: "var(--text-tertiary)" }}>
            No alert rules configured.
          </p>
        )}
      </div>

      <div role="status" aria-live="polite" className="min-h-5 py-2 text-[11px]" style={{ color: "var(--evidence)" }}>
        {feedback}
      </div>

      {showForm ? (
        <div className="border-y py-4" style={{ borderColor: "var(--line-soft)" }}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="mono text-[12px] uppercase tracking-[0.1em]" style={{ color: "var(--text-primary)" }}>
              {editingId ? messages.editRule : messages.addRule}
            </h3>
            <button type="button" onClick={closeForm} disabled={saving} className={actionClass} style={{ color: "var(--text-tertiary)" }}>
              {messages.cancel}
            </button>
          </div>

          <div className="grid gap-4">
            <div>
              <label htmlFor="alert-rule-name" className="mono mb-1 block text-[11px] uppercase tracking-[0.08em]" style={{ color: "var(--text-tertiary)" }}>
                {messages.labelName}
              </label>
              <input
                id="alert-rule-name"
                type="text"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                className={controlClass + " w-full"}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="alert-rule-layer" className="mono mb-1 block text-[11px] uppercase tracking-[0.08em]" style={{ color: "var(--text-tertiary)" }}>
                  {messages.labelLayer}
                </label>
                <select id="alert-rule-layer" value={form.layer} onChange={(event) => setForm((current) => ({ ...current, layer: event.target.value }))} className={controlClass + " w-full"}>
                  {LAYER_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="alert-rule-destination" className="mono mb-1 block text-[11px] uppercase tracking-[0.08em]" style={{ color: "var(--text-tertiary)" }}>
                  {messages.labelDestination}
                </label>
                <select id="alert-rule-destination" value={form.destination} onChange={(event) => setForm((current) => ({ ...current, destination: event.target.value }))} className={controlClass + " w-full"}>
                  {DESTINATION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="alert-rule-confidence" className="mono mb-1 flex items-center justify-between text-[11px] uppercase tracking-[0.08em]" style={{ color: "var(--text-tertiary)" }}>
                  <span>{messages.labelMinConf}</span>
                  <span style={{ color: "var(--evidence)" }}>{form.minConfidence}%</span>
                </label>
                <input
                  id="alert-rule-confidence"
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={form.minConfidence}
                  onChange={(event) => setForm((current) => ({ ...current, minConfidence: Number(event.target.value) }))}
                  className="min-h-11 w-full accent-[var(--evidence)]"
                />
              </div>
              <div>
                <label htmlFor="alert-rule-priority" className="mono mb-1 block text-[11px] uppercase tracking-[0.08em]" style={{ color: "var(--text-tertiary)" }}>
                  {messages.labelPriority}
                </label>
                <select id="alert-rule-priority" value={form.priority} onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))} className={controlClass + " w-full"}>
                  {PRIORITY_OPTIONS.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
                </select>
              </div>
            </div>

            <button
              type="button"
              aria-pressed={form.enabled}
              onClick={() => setForm((current) => ({ ...current, enabled: !current.enabled }))}
              className="flex min-h-11 items-center justify-between border px-3 text-left transition-colors duration-[var(--motion-micro)] hover:bg-[var(--signal-wash)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--signal)] motion-reduce:transition-none"
              style={{ borderColor: form.enabled ? "var(--evidence)" : "var(--line-soft)" }}
            >
              <span className="mono text-[11px] uppercase tracking-[0.08em]" style={{ color: "var(--text-secondary)" }}>{messages.labelEnabled}</span>
              <span className="mono text-[11px] uppercase tracking-[0.08em]" style={{ color: form.enabled ? "var(--evidence)" : "var(--text-tertiary)" }}>
                {form.enabled ? "On" : "Off"}
              </span>
            </button>

            {error ? <div role="alert" className="text-[12px]" style={{ color: "var(--critical)" }}>{error}</div> : null}

            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" onClick={closeForm} disabled={saving} className={actionClass} style={{ color: "var(--text-tertiary)" }}>
                {messages.cancel}
              </button>
              <button type="button" onClick={handleSave} disabled={saving} className={actionClass} style={{ borderColor: "var(--signal)", color: "var(--signal)" }}>
                {saving ? "Working…" : messages.save}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button type="button" onClick={openAdd} className={actionClass} style={{ borderColor: "var(--signal)", color: "var(--signal)" }}>
          + {messages.addRule}
        </button>
      )}
    </div>
  );
}
