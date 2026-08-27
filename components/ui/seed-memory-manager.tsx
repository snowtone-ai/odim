"use client";

import { useRef, useState } from "react";

const ACCEPTED_SEEDS = ".txt,.md,.json,.csv,.ts,.tsx,.js,.jsx,.py,.yaml,.yml,.toml";
const MAX_SEED_BYTES = 100 * 1024;

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

const fieldStyle = {
  background: "var(--field)",
  border: "1px solid var(--line-soft)",
  color: "var(--text-primary)"
} as const;

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_SEED_BYTES) {
      setError("File too large (max " + MAX_SEED_BYTES / 1024 + " KB)");
      return;
    }
    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const text = (loadEvent.target?.result as string) ?? "";
      setNewContent((previous) => (previous ? previous + "\n\n" : "") + text);
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

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
    const payload = await requestSeedMemory("/api/seed-memory?orgId=" + encodeURIComponent(orgId) + "&id=" + encodeURIComponent(id), { method: "DELETE" });
    if (payload) setSeeds((current) => current.filter((seed) => seed.id !== id));
  }

  return (
    <div className="min-w-0">
      <div className="border-y" style={{ borderColor: "var(--line-soft)" }}>
        <label className="block border-b p-3" style={{ borderColor: "var(--line-faint)" }}>
          <span className="mono mb-2 block text-[11px] uppercase tracking-[0.12em]" style={{ color: "var(--text-tertiary)" }}>{labels.content}</span>
          <textarea className="min-h-28 w-full resize-y border p-3 text-[13px] leading-relaxed outline-none focus-visible:border-[var(--signal)]" onChange={(event) => setNewContent(event.target.value)} placeholder={labels.content} value={newContent} style={fieldStyle} />
        </label>
        <div className="flex flex-wrap items-center gap-2 p-3">
          <div className="flex min-h-11 items-center gap-1 border p-1" role="group" aria-label="Knowledge type" style={{ borderColor: "var(--line-soft)" }}>
            {(["fact", "opinion"] as const).map((kind) => {
              const selected = newKind === kind;
              return <button key={kind} type="button" aria-pressed={selected} onClick={() => setNewKind(kind)} className="min-h-11 px-3 text-[12px] transition-colors duration-[120ms] focus-visible:outline-2 focus-visible:outline-[var(--signal)] motion-reduce:transition-none" style={{ background: selected ? "var(--evidence-wash)" : "transparent", color: selected ? "var(--evidence)" : "var(--text-tertiary)" }}>{kind === "opinion" ? labels.opinion : labels.fact}</button>;
            })}
          </div>
          <button type="button" onClick={() => fileInputRef.current?.click()} className="min-h-11 border px-3 text-[12px] transition-colors duration-[120ms] hover:bg-[var(--surface-hover)] focus-visible:outline-2 focus-visible:outline-[var(--signal)] motion-reduce:transition-none" style={{ borderColor: "var(--line-soft)", color: "var(--text-secondary)" }}>Attach file</button>
          <input ref={fileInputRef} type="file" className="hidden" accept={ACCEPTED_SEEDS} onChange={handleFileUpload} />
          <button type="button" disabled={pending || !newContent.trim()} onClick={createSeed} className="min-h-11 border px-4 text-[12px] transition-colors duration-[120ms] hover:bg-[var(--signal-wash)] focus-visible:outline-2 focus-visible:outline-[var(--signal)] disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:transition-none" style={{ background: "var(--signal-wash)", borderColor: "var(--signal)", color: "var(--signal)" }}>{labels.create}</button>
        </div>
      </div>

      {error ? <div className="mt-3 mono text-[12px] uppercase tracking-[0.1em]" aria-live="assertive" style={{ color: "var(--critical)" }}>{error}</div> : null}
      <div className="mt-5 border-y" style={{ borderColor: "var(--line-soft)" }}>
        {seeds.length ? seeds.map((seed) => (
          <div className="border-b px-3 py-4 last:border-b-0" style={{ borderColor: "var(--line-faint)" }} key={seed.id}>
            {editingId === seed.id ? (
              <textarea className="min-h-28 w-full resize-y border p-3 text-[13px] leading-relaxed outline-none focus-visible:border-[var(--signal)]" onChange={(event) => setEditingContent(event.target.value)} value={editingContent} style={fieldStyle} />
            ) : (
              <div className="whitespace-pre-wrap text-[13px] leading-relaxed" style={{ color: "var(--text-primary)" }}>{seed.content}</div>
            )}
            <div className="mono mt-2 text-[11px] uppercase tracking-[0.12em]" style={{ color: seed.kind === "opinion" ? "var(--evidence)" : "var(--text-tertiary)" }}>{seed.kind === "opinion" ? labels.opinion : labels.fact} / MVCC</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {editingId === seed.id ? (
                <>
                  <SeedButton disabled={pending} onClick={() => updateSeed(seed.id)} label={labels.save} primary />
                  <SeedButton disabled={pending} onClick={() => { setEditingId(null); setEditingContent(""); }} label={labels.cancel} />
                </>
              ) : (
                <>
                  <SeedButton disabled={pending} onClick={() => { setEditingId(seed.id); setEditingContent(seed.content); }} label={labels.edit} />
                  <SeedButton disabled={pending} onClick={() => retireSeed(seed.id)} label={labels.delete} danger />
                </>
              )}
            </div>
          </div>
        )) : <div className="px-3 py-6 text-[13px]" aria-live="polite" style={{ color: "var(--text-secondary)" }}>{labels.empty}</div>}
      </div>
    </div>
  );
}

function SeedButton({ disabled, onClick, label, primary = false, danger = false }: Readonly<{ disabled: boolean; onClick: () => void; label: string; primary?: boolean; danger?: boolean }>) {
  return <button type="button" disabled={disabled} onClick={onClick} className="min-h-11 border px-3 text-[12px] transition-colors duration-[120ms] hover:bg-[var(--surface-hover)] focus-visible:outline-2 focus-visible:outline-[var(--signal)] disabled:opacity-45 motion-reduce:transition-none" style={{ background: primary ? "var(--signal-wash)" : "transparent", borderColor: primary ? "var(--signal)" : "var(--line-soft)", color: danger ? "var(--critical)" : primary ? "var(--signal)" : "var(--text-secondary)" }}>{label}</button>;
}
