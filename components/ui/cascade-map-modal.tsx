"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, ExternalLink, RefreshCw, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { trapDialogFocus } from "@/components/ui/modal-focus";

type CascadeChild = {
  id: string;
  name: string;
  confidence: number;
  linkType: string;
  capitalWeight: number;
  coverageGapScore: number;
};

type CascadeSubstrate = {
  layer: string;
  id: string;
  name: string;
  children: CascadeChild[];
};

type CascadeData = {
  entity: { id: string; name: string; score: number };
  substrates: CascadeSubstrate[];
};

type Messages = {
  cascadeMapTitle: string;
  cascadeClose: string;
  lowCoverage: string;
  loading?: string;
  errorRetry?: string;
};

type Props = Readonly<{
  open: boolean;
  entityId: string | null;
  onClose: () => void;
  messages: Messages;
}>;

const LAYER_COLORS: Record<string, string> = {
  energy: "var(--evidence)",
  cash: "var(--signal)",
  land: "var(--text-secondary)",
  compute: "var(--signal)",
  water: "var(--evidence)",
  raw_materials: "var(--text-secondary)",
  logistics: "var(--text-tertiary)"
};

const LINK_COLORS: Record<string, string> = {
  supply: "var(--evidence)",
  compete: "var(--critical)",
  capital: "var(--signal)",
  regulatory: "var(--text-secondary)",
  subsidiary: "var(--signal)",
  parent_company: "var(--evidence)",
  ultimate_parent: "var(--evidence)"
};

function coverage(value: number) {
  return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
}

function titleCase(value: string) {
  return value.replaceAll("_", " ");
}

export function CascadeMapModal({ open, entityId, onClose, messages }: Props) {
  const router = useRouter();
  const [data, setData] = useState<CascadeData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousActiveRef = useRef<HTMLElement | null>(null);

  const fetchData = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const response = await fetch(`/api/entity-cascade?id=${encodeURIComponent(id)}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setData(await response.json() as CascadeData);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && entityId) void fetchData(entityId);
    else {
      setData(null);
      setError(null);
    }
  }, [open, entityId, fetchData]);

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    previousActiveRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!dialog.open) dialog.showModal();
    const frame = requestAnimationFrame(() => closeButtonRef.current?.focus());
    return () => {
      cancelAnimationFrame(frame);
      if (dialog.open) dialog.close();
      previousActiveRef.current?.focus();
    };
  }, [open]);

  if (!open || !entityId) return null;

  function openEntity(id: string) {
    router.push(`/entity?id=${encodeURIComponent(id)}`);
    onClose();
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="cascade-map-title"
      className="fixed inset-0 z-50 m-0 h-dvh max-h-none w-screen max-w-none overflow-y-auto border-0 bg-[color-mix(in_srgb,var(--field)_90%,transparent)] px-3 py-3 sm:px-6 sm:py-8"
      onKeyDown={trapDialogFocus}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div
        className="animate-slide-up mx-auto w-full max-w-[1120px] border bg-[var(--surface)]"
        style={{ borderColor: "var(--line-strong)", boxShadow: "var(--shadow-lg)" }}
      >
        <header className="flex items-start justify-between gap-4 border-b px-5 py-5 sm:px-7" style={{ borderColor: "var(--line-soft)" }}>
          <div className="min-w-0">
            <p className="mono text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--evidence)" }}>{messages.cascadeMapTitle}</p>
            {data ? <h2 id="cascade-map-title" className="mt-2 truncate text-[19px] font-medium" style={{ color: "var(--text)" }}>{data.entity.name}<span className="mono ml-3 text-[11px] font-normal" style={{ color: "var(--signal)" }}>Score {data.entity.score}</span></h2> : <h2 id="cascade-map-title" className="sr-only">{messages.cascadeMapTitle}</h2>}
            <p className="mt-2 text-[12px]" style={{ color: "var(--text-secondary)" }}>Object → substrate → linked entity</p>
          </div>
          <button ref={closeButtonRef} type="button" onClick={onClose} className="odim-control inline-flex min-h-11 items-center gap-2 px-3 text-[11px]" aria-label={messages.cascadeClose}>
            {messages.cascadeClose}<X size={15} />
          </button>
        </header>

        <div className="min-h-[280px] overflow-auto px-5 py-6 sm:px-7">
          {loading ? <div className="flex min-h-[240px] items-center justify-center"><span className="mono text-[11px] uppercase tracking-[0.12em]" style={{ color: "var(--text-tertiary)" }}>{messages.loading ?? "Loading…"}</span></div> : null}
          {error ? (
            <div className="flex min-h-[240px] flex-col items-center justify-center gap-4 text-center">
              <p className="text-[13px]" style={{ color: "var(--critical)" }}>{error}</p>
              <button type="button" onClick={() => entityId && void fetchData(entityId)} className="odim-control inline-flex min-h-11 items-center gap-2 px-3 text-[12px]" style={{ color: "var(--signal)" }}><RefreshCw size={14} />{messages.errorRetry ?? "Retry"}</button>
            </div>
          ) : null}
          {data ? (
            <div className="grid gap-0 lg:grid-cols-[180px_minmax(180px,0.8fr)_minmax(300px,1.4fr)]">
              <div className="border-b pb-6 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-6" style={{ borderColor: "var(--line-soft)" }}>
                <p className="mono text-[11px] uppercase tracking-[0.12em]" style={{ color: "var(--text-tertiary)" }}>L1 object</p>
                <button type="button" onClick={() => openEntity(data.entity.id)} className="mt-4 w-full border-l-2 px-3 py-3 text-left transition-colors duration-[var(--motion-micro)] hover:bg-[var(--signal-wash)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--signal)]" style={{ borderColor: "var(--signal)" }}>
                  <span className="block text-[14px] font-medium" style={{ color: "var(--text)" }}>{data.entity.name}</span>
                  <span className="mono mt-2 block text-[11px]" style={{ color: "var(--text-tertiary)" }}>{data.entity.id}</span>
                  <span className="mono mt-3 block text-[11px]" style={{ color: "var(--signal)" }}>Score {data.entity.score}</span>
                </button>
              </div>

              <div className="border-b py-6 lg:border-b-0 lg:border-r lg:px-6 lg:py-0" style={{ borderColor: "var(--line-soft)" }}>
                <p className="mono text-[11px] uppercase tracking-[0.12em]" style={{ color: "var(--text-tertiary)" }}>L2 substrates</p>
                <div className="mt-4 divide-y" style={{ borderColor: "var(--line-soft)" }}>
                  {data.substrates.slice(0, 6).map((substrate) => (
                    <div key={substrate.id} className="flex items-center justify-between gap-3 py-3 first:pt-0">
                      <div className="min-w-0">
                        <p className="truncate text-[13px]" style={{ color: LAYER_COLORS[substrate.layer] ?? "var(--text-secondary)" }}>{substrate.name}</p>
                        <p className="mono mt-1 truncate text-[11px] uppercase" style={{ color: "var(--text-tertiary)" }}>{titleCase(substrate.layer)}</p>
                      </div>
                      <span className="mono shrink-0 text-[11px]" style={{ color: "var(--text-tertiary)" }}>{Math.min(substrate.children.length, 3)} links</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-6 lg:pl-6 lg:pt-0">
                <div className="flex items-center justify-between gap-3">
                  <p className="mono text-[11px] uppercase tracking-[0.12em]" style={{ color: "var(--text-tertiary)" }}>L3 linked entities</p>
                  <span className="mono text-[11px]" style={{ color: "var(--text-tertiary)" }}>{data.substrates.reduce((total, substrate) => total + Math.min(substrate.children.length, 3), 0)} shown</span>
                </div>
                <div className="mt-4 divide-y" style={{ borderColor: "var(--line-soft)" }}>
                  {data.substrates.slice(0, 6).flatMap((substrate) => substrate.children.slice(0, 3).map((child) => (
                    <div key={child.id} className="flex items-center gap-3 py-3 first:pt-0">
                      <ArrowRight size={14} className="shrink-0" style={{ color: LINK_COLORS[child.linkType] ?? "var(--text-tertiary)" }} aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <button type="button" onClick={() => openEntity(child.id)} className="inline-flex min-h-11 max-w-full items-center gap-2 text-left text-[13px] transition-colors duration-[var(--motion-micro)] hover:text-[var(--signal)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--signal)]" style={{ color: "var(--text)" }}>
                          <span className="truncate">{child.name}</span><ExternalLink size={12} className="shrink-0" aria-hidden="true" />
                        </button>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="mono text-[11px] uppercase" style={{ color: LINK_COLORS[child.linkType] ?? "var(--text-tertiary)" }}>{titleCase(child.linkType)}</span>
                          <span className="mono text-[11px]" style={{ color: "var(--text-tertiary)" }}>Confidence {coverage(child.confidence)}</span>
                          <span className="mono text-[11px]" style={{ color: "var(--text-tertiary)" }}>Capital {child.capitalWeight >= 1_000_000_000 ? `${(child.capitalWeight / 1_000_000_000).toFixed(1)}B` : `${Math.round(child.capitalWeight / 1_000_000)}M`}</span>
                          <span className="mono text-[11px]" style={{ color: child.coverageGapScore < 0.3 ? "var(--critical)" : "var(--text-tertiary)" }}>{child.coverageGapScore < 0.3 ? messages.lowCoverage : `Coverage ${coverage(child.coverageGapScore)}`}</span>
                        </div>
                      </div>
                    </div>
                  )))}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </dialog>
  );
}
