"use client";

import { useState } from "react";

type SeedMemoryView = {
  id: string;
  kind: "memory" | "opinion";
  content: string;
  orgId: string;
};

type SeedLabels = {
  fact: string;
  opinion: string;
  create: string;
  edit: string;
  delete: string;
  save: string;
  cancel: string;
  content: string;
  empty: string;
  error: string;
};

export function SeedMemoryManager({
  initialSeeds,
  labels,
  orgId
}: Readonly<{
  initialSeeds: SeedMemoryView[];
  labels: SeedLabels;
  orgId: string;
}>) {
  const [seeds, setSeeds] = useState(initialSeeds);
  const [newContent, setNewContent] = useState("");
  const [newKind, setNewKind] = useState<"fact" | "opinion">("fact");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function requestSeedMemory(path: string, init: RequestInit) {
    setPending(true);
    setError("");
    try {
      const response = await fetch(path, init);
      const payload = (await response.json().catch(() => ({}))) as { seed?: SeedMemoryView; error?: string; id?: string };
      if (!response.ok) throw new Error(payload.error ?? labels.error);
      return payload;
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : labels.error);
      return undefined;
    } finally {
      setPending(false);
    }
  }

  async function createSeed() {
    const content = newContent.trim();
    if (!content) return;
    const payload = await requestSeedMemory("/api/seed-memory", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ orgId, content, memoryClass: newKind })
    });
    if (payload?.seed) {
      setSeeds((current) => [...current, payload.seed as SeedMemoryView]);
      setNewContent("");
    }
  }

  async function updateSeed(id: string) {
    const content = editingContent.trim();
    if (!content) return;
    const payload = await requestSeedMemory("/api/seed-memory", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ orgId, id, content })
    });
    if (payload?.seed) {
      setSeeds((current) => current.map((seed) => (seed.id === id ? (payload.seed as SeedMemoryView) : seed)));
      setEditingId(null);
      setEditingContent("");
    }
  }

  async function retireSeed(id: string) {
    const payload = await requestSeedMemory(`/api/seed-memory?orgId=${encodeURIComponent(orgId)}&id=${encodeURIComponent(id)}`, {
      method: "DELETE"
    });
    if (payload) setSeeds((current) => current.filter((seed) => seed.id !== id));
  }

  return (
    <div className="grid gap-4">
      <div
        className="grid gap-3 rounded-[var(--radius-md)] p-3.5"
        style={{
          background: "var(--ink-850)",
          border: "1px solid var(--line-faint)",
          boxShadow: "var(--shadow-inset)"
        }}
      >
        <textarea
          className="min-h-20 rounded-[var(--radius-md)] bg-[var(--ink-900)] p-3 text-sm text-[var(--text-primary)] outline-none transition-all duration-[var(--dur-fast)] placeholder:text-[var(--text-quaternary)] focus:shadow-[0_0_0_1px_var(--rune-dim)]"
          style={{
            border: "1px solid var(--line-faint)",
            boxShadow: "inset 0 1px 0 rgba(0,0,0,0.2)"
          }}
          onChange={(event) => setNewContent(event.target.value)}
          placeholder={labels.content}
          value={newContent}
        />
        <div className="flex flex-wrap items-center gap-2">
          {(["fact", "opinion"] as const).map((kind) => (
            <button
              className={`rounded-[var(--radius-sm)] px-3 py-1.5 text-[11px] transition-all duration-[var(--dur-fast)] ease-[var(--ease-out-expo)] ${
                newKind === kind
                  ? "text-[var(--rune)] shadow-[0_0_6px_rgba(201,169,97,0.1)]"
                  : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
              }`}
              style={{
                background: newKind === kind ? "var(--rune-wash)" : "var(--ink-750)",
                border: newKind === kind ? "1px solid rgba(201,169,97,0.15)" : "1px solid var(--line-faint)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)"
              }}
              key={kind}
              onClick={() => setNewKind(kind)}
              type="button"
            >
              {kind === "opinion" ? labels.opinion : labels.fact}
            </button>
          ))}
          <button
            className="rounded-[var(--radius-sm)] px-3 py-1.5 text-[11px] font-medium text-[var(--text-primary)] transition-all duration-[var(--dur-fast)] ease-[var(--ease-out-expo)] disabled:opacity-40"
            style={{
              background: "linear-gradient(180deg, var(--ink-700) 0%, var(--ink-750) 100%)",
              border: "1px solid var(--line-soft)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04), var(--shadow-sm)"
            }}
            disabled={pending || !newContent.trim()}
            onClick={createSeed}
            type="button"
          >
            {labels.create}
          </button>
        </div>
      </div>

      {error ? <div className="text-xs text-[var(--negative)]">{error}</div> : null}
      {seeds.length ? (
        <div className="grid gap-3">
          {seeds.map((seed) => (
            <div
              className="pb-3.5 text-sm"
              style={{ borderBottom: "1px solid var(--line-faint)" }}
              key={seed.id}
            >
              {editingId === seed.id ? (
                <textarea
                  className="min-h-20 w-full rounded-[var(--radius-md)] bg-[var(--ink-900)] p-3 text-sm text-[var(--text-primary)] outline-none transition-all duration-[var(--dur-fast)] focus:shadow-[0_0_0_1px_var(--rune-dim)]"
                  style={{
                    border: "1px solid var(--line-faint)",
                    boxShadow: "inset 0 1px 0 rgba(0,0,0,0.2)"
                  }}
                  onChange={(event) => setEditingContent(event.target.value)}
                  value={editingContent}
                />
              ) : (
                <div className="text-[13px] leading-relaxed">{seed.content}</div>
              )}
              <div className="mono mt-2 text-[10px] uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
                {seed.kind === "opinion" ? labels.opinion : labels.fact} / MVCC
              </div>
              <div className="mt-3 flex gap-2">
                {editingId === seed.id ? (
                  <>
                    <SeedButton disabled={pending} onClick={() => updateSeed(seed.id)} label={labels.save} />
                    <SeedButton disabled={pending} onClick={() => { setEditingId(null); setEditingContent(""); }} label={labels.cancel} />
                  </>
                ) : (
                  <>
                    <SeedButton disabled={pending} onClick={() => { setEditingId(seed.id); setEditingContent(seed.content); }} label={labels.edit} />
                    <SeedButton disabled={pending} onClick={() => retireSeed(seed.id)} label={labels.delete} />
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-[13px] text-[var(--text-tertiary)]">{labels.empty}</div>
      )}
    </div>
  );
}

function SeedButton({ disabled, onClick, label }: Readonly<{ disabled: boolean; onClick: () => void; label: string }>) {
  return (
    <button
      className="rounded-[var(--radius-sm)] px-3 py-1.5 text-[11px] text-[var(--text-secondary)] transition-all duration-[var(--dur-fast)] ease-[var(--ease-out-expo)] disabled:opacity-40 hover:text-[var(--text-primary)]"
      style={{
        background: "var(--ink-750)",
        border: "1px solid var(--line-faint)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)"
      }}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}
