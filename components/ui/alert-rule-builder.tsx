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
  const [error, setError] = useState<string | null>(null);

  function openAdd() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(true);
    setError(null);
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
    try {
      const payload = {
        name: form.name.trim(),
        layer: form.layer,
        minConfidence: form.minConfidence / 100,
        destination: form.destination,
        enabled: form.enabled
      };

      if (editingId) {
        const res = await fetch(`/api/alert-rules?id=${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error(await res.text());
        setRules((prev) =>
          prev.map((r) =>
            r.id === editingId ? { ...r, ...payload } : r
          )
        );
      } else {
        const res = await fetch("/api/alert-rules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error(await res.text());
        const { rule } = await res.json() as { rule: ExistingRule };
        setRules((prev) => [rule, ...prev]);
      }
      closeForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/alert-rules?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      setRules((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      console.warn("Delete failed", err);
    }
  }

  async function handleToggle(rule: ExistingRule) {
    try {
      const res = await fetch(`/api/alert-rules?id=${rule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !rule.enabled })
      });
      if (!res.ok) throw new Error(await res.text());
      setRules((prev) =>
        prev.map((r) => (r.id === rule.id ? { ...r, enabled: !r.enabled } : r))
      );
    } catch (err) {
      console.warn("Toggle failed", err);
    }
  }

  return (
    <div>
      {/* Existing rules */}
      <div className="grid gap-2.5 mb-3">
        {rules.map((rule) => (
          <div
            key={rule.id}
            className="pb-3"
            style={{ borderBottom: "1px solid var(--line-faint)" }}
          >
            <div className="flex items-center justify-between gap-2 text-[13px]">
              <span
                className="truncate"
                style={{
                  color: rule.enabled ? "var(--text-primary)" : "var(--text-tertiary)"
                }}
              >
                {rule.name}
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => handleToggle(rule)}
                  className="mono text-[9px] uppercase tracking-[0.1em] px-1.5 py-0.5 rounded transition-colors"
                  style={{
                    background: rule.enabled ? "rgba(201,169,97,0.1)" : "var(--surface-tertiary)",
                    border: "1px solid var(--line-faint)",
                    color: rule.enabled ? "var(--rune)" : "var(--text-tertiary)"
                  }}
                >
                  {rule.enabled ? "On" : "Off"}
                </button>
                <button
                  type="button"
                  onClick={() => openEdit(rule)}
                  className="mono text-[9px] uppercase tracking-[0.1em] px-1.5 py-0.5 rounded transition-colors hover:text-[var(--rune)]"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {messages.editRule}
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(rule.id)}
                  className="mono text-[9px] uppercase tracking-[0.1em] px-1.5 py-0.5 rounded transition-colors hover:text-[var(--critical)]"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {messages.deleteRule}
                </button>
              </div>
            </div>
            <div className="mono mt-1 text-[10px] uppercase tracking-[0.11em]" style={{ color: "var(--text-tertiary)" }}>
              {rule.layer} · {rule.destination} · {Math.round(rule.minConfidence * 100)}%
            </div>
          </div>
        ))}
      </div>

      {/* Inline form */}
      {showForm ? (
        <div
          className="rounded-[var(--radius-md)] p-4 mt-3"
          style={{
            background: "var(--surface-secondary)",
            border: "1px solid var(--line-faint)"
          }}
        >
          <div className="grid gap-3">
            {/* Name */}
            <div>
              <label className="mono text-[9px] uppercase tracking-[0.1em] block mb-1" style={{ color: "var(--text-tertiary)" }}>
                {messages.labelName}
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full rounded px-2.5 py-1.5 text-[12px] outline-none"
                style={{
                  background: "var(--surface-primary)",
                  border: "1px solid var(--line-faint)",
                  color: "var(--text-primary)"
                }}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Layer */}
              <div>
                <label className="mono text-[9px] uppercase tracking-[0.1em] block mb-1" style={{ color: "var(--text-tertiary)" }}>
                  {messages.labelLayer}
                </label>
                <select
                  value={form.layer}
                  onChange={(e) => setForm((f) => ({ ...f, layer: e.target.value }))}
                  className="w-full rounded px-2.5 py-1.5 text-[12px] outline-none"
                  style={{
                    background: "var(--surface-primary)",
                    border: "1px solid var(--line-faint)",
                    color: "var(--text-primary)"
                  }}
                >
                  {LAYER_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* Destination */}
              <div>
                <label className="mono text-[9px] uppercase tracking-[0.1em] block mb-1" style={{ color: "var(--text-tertiary)" }}>
                  {messages.labelDestination}
                </label>
                <select
                  value={form.destination}
                  onChange={(e) => setForm((f) => ({ ...f, destination: e.target.value }))}
                  className="w-full rounded px-2.5 py-1.5 text-[12px] outline-none"
                  style={{
                    background: "var(--surface-primary)",
                    border: "1px solid var(--line-faint)",
                    color: "var(--text-primary)"
                  }}
                >
                  {DESTINATION_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Min confidence */}
              <div>
                <label className="mono text-[9px] uppercase tracking-[0.1em] block mb-1 flex items-center justify-between" style={{ color: "var(--text-tertiary)" }}>
                  <span>{messages.labelMinConf}</span>
                  <span style={{ color: "var(--rune)" }}>{form.minConfidence}%</span>
                </label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={form.minConfidence}
                  onChange={(e) => setForm((f) => ({ ...f, minConfidence: Number(e.target.value) }))}
                  className="w-full"
                  style={{ accentColor: "var(--rune)" }}
                />
              </div>

              {/* Priority */}
              <div>
                <label className="mono text-[9px] uppercase tracking-[0.1em] block mb-1" style={{ color: "var(--text-tertiary)" }}>
                  {messages.labelPriority}
                </label>
                <select
                  value={form.priority}
                  onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
                  className="w-full rounded px-2.5 py-1.5 text-[12px] outline-none"
                  style={{
                    background: "var(--surface-primary)",
                    border: "1px solid var(--line-faint)",
                    color: "var(--text-primary)"
                  }}
                >
                  {PRIORITY_OPTIONS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Enabled toggle */}
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, enabled: !f.enabled }))}
                className="w-8 h-4 rounded-full transition-colors relative"
                style={{
                  background: form.enabled ? "var(--rune)" : "var(--line-faint)"
                }}
              >
                <span
                  className="absolute top-0.5 rounded-full transition-all"
                  style={{
                    left: form.enabled ? "calc(100% - 14px)" : "2px",
                    width: 12,
                    height: 12,
                    background: "white"
                  }}
                />
              </button>
              <span className="mono text-[10px] uppercase tracking-[0.1em]" style={{ color: "var(--text-secondary)" }}>
                {messages.labelEnabled}
              </span>
            </div>

            {error && (
              <div className="text-[11px]" style={{ color: "var(--critical)" }}>
                {error}
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                className="mono text-[10px] uppercase tracking-[0.1em] px-3 py-1.5 rounded transition-colors"
                style={{
                  background: "var(--surface-tertiary)",
                  border: "1px solid var(--line-faint)",
                  color: "var(--text-secondary)"
                }}
              >
                {messages.cancel}
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="mono text-[10px] uppercase tracking-[0.1em] px-3 py-1.5 rounded transition-colors"
                style={{
                  background: saving ? "var(--rune-wash)" : "rgba(201,169,97,0.15)",
                  border: "1px solid rgba(201,169,97,0.3)",
                  color: "var(--rune)"
                }}
              >
                {saving ? "…" : messages.save}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={openAdd}
          className="mono text-[10px] uppercase tracking-[0.1em] px-3 py-1.5 rounded transition-colors hover:brightness-110"
          style={{
            background: "rgba(201,169,97,0.08)",
            border: "1px solid rgba(201,169,97,0.22)",
            color: "var(--rune)"
          }}
        >
          + {messages.addRule}
        </button>
      )}
    </div>
  );
}
