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
      <div className="grid gap-3 rounded-[var(--radius-md)] border border-[var(--line-faint)] p-3">
        <textarea
          className="min-h-20 rounded-[var(--radius-sm)] border border-[var(--line-faint)] bg-[var(--ink-900)] p-3 text-sm outline-none"
          onChange={(event) => setNewContent(event.target.value)}
          placeholder={labels.content}
          value={newContent}
        />
        <div className="flex flex-wrap items-center gap-2">
          {(["fact", "opinion"] as const).map((kind) => (
            <button
              className={`rounded-[var(--radius-sm)] border px-3 py-1 text-xs ${
                newKind === kind ? "border-[var(--rune)] text-[var(--rune)]" : "border-[var(--line-faint)] text-[var(--text-tertiary)]"
              }`}
              key={kind}
              onClick={() => setNewKind(kind)}
              type="button"
            >
              {kind === "opinion" ? labels.opinion : labels.fact}
            </button>
          ))}
          <button
            className="rounded-[var(--radius-sm)] border border-[var(--line-faint)] px-3 py-1 text-xs text-[var(--text-primary)] disabled:opacity-50"
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
            <div className="border-b border-[var(--line-faint)] pb-3 text-sm" key={seed.id}>
              {editingId === seed.id ? (
                <textarea
                  className="min-h-20 w-full rounded-[var(--radius-sm)] border border-[var(--line-faint)] bg-[var(--ink-900)] p-3 text-sm outline-none"
                  onChange={(event) => setEditingContent(event.target.value)}
                  value={editingContent}
                />
              ) : (
                <div>{seed.content}</div>
              )}
              <div className="mono mt-2 text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                {seed.kind === "opinion" ? labels.opinion : labels.fact} / MVCC
              </div>
              <div className="mt-3 flex gap-2">
                {editingId === seed.id ? (
                  <>
                    <button
                      className="rounded-[var(--radius-sm)] border border-[var(--line-faint)] px-3 py-1 text-xs"
                      disabled={pending}
                      onClick={() => updateSeed(seed.id)}
                      type="button"
                    >
                      {labels.save}
                    </button>
                    <button
                      className="rounded-[var(--radius-sm)] border border-[var(--line-faint)] px-3 py-1 text-xs"
                      disabled={pending}
                      onClick={() => {
                        setEditingId(null);
                        setEditingContent("");
                      }}
                      type="button"
                    >
                      {labels.cancel}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="rounded-[var(--radius-sm)] border border-[var(--line-faint)] px-3 py-1 text-xs"
                      disabled={pending}
                      onClick={() => {
                        setEditingId(seed.id);
                        setEditingContent(seed.content);
                      }}
                      type="button"
                    >
                      {labels.edit}
                    </button>
                    <button
                      className="rounded-[var(--radius-sm)] border border-[var(--line-faint)] px-3 py-1 text-xs"
                      disabled={pending}
                      onClick={() => retireSeed(seed.id)}
                      type="button"
                    >
                      {labels.delete}
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-[var(--text-tertiary)]">{labels.empty}</div>
      )}
    </div>
  );
}
