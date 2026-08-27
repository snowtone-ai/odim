"use client";

import { useEffect, useState } from "react";
import { HuginnIcon } from "@/components/ui/huginn-icon";

const THINKING_PHASES = [
  "Preparing analysis",
  "Tracing evidence",
  "Checking support"
] as const;

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function useReducedMotionPreference() {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY);
    const updatePreference = () => setReducedMotion(mediaQuery.matches);

    updatePreference();
    mediaQuery.addEventListener("change", updatePreference);
    return () => mediaQuery.removeEventListener("change", updatePreference);
  }, []);

  return reducedMotion;
}

export function HuginnThinking() {
  const reducedMotion = useReducedMotionPreference();
  const [phaseIndex, setPhaseIndex] = useState(0);

  useEffect(() => {
    if (reducedMotion) {
      setPhaseIndex(0);
      return;
    }

    const phaseTimer = window.setInterval(() => {
      setPhaseIndex((current) => (current + 1) % THINKING_PHASES.length);
    }, 1600);

    return () => window.clearInterval(phaseTimer);
  }, [reducedMotion]);

  const phase = reducedMotion ? THINKING_PHASES[0] : THINKING_PHASES[phaseIndex];

  return (
    <div
      className="flex h-11 min-h-11 items-center gap-3 border-l-2 pl-4 text-[13px] leading-5 text-[var(--text-secondary)]"
      data-testid="huginn-thinking"
      style={{ borderColor: "var(--evidence)" }}
    >
      <span className="sr-only" role="status" aria-live="polite">
        Huginn is working.
      </span>
      <HuginnIcon className="shrink-0" size={20} />
      {/* MIT-licensed svg-spinners 3-dots-fade adaptation; attribution is in THIRD_PARTY_NOTICES.md. */}
      <svg
        aria-hidden="true"
        className="h-4 w-4 shrink-0 text-[var(--evidence)]"
        fill="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <style>{`
          .huginn-thinking-dot { animation: huginn-thinking-dots .8s linear infinite; animation-delay: -.8s; }
          .huginn-thinking-dot--middle { animation-delay: -.65s; }
          .huginn-thinking-dot--last { animation-delay: -.5s; }
          @keyframes huginn-thinking-dots { 93.75%, 100% { opacity: .2; } }
          @keyframes huginn-thinking-phase-enter { from { opacity: .35; } to { opacity: 1; } }
          .huginn-thinking-phase { animation: huginn-thinking-phase-enter .24s ease-out both; }
          @media (prefers-reduced-motion: reduce) {
            .huginn-thinking-dot { animation: none; opacity: .72; }
            .huginn-thinking-phase { animation: none; }
          }
        `}</style>
        <circle className="huginn-thinking-dot" cx="4" cy="12" r="3" />
        <circle className="huginn-thinking-dot huginn-thinking-dot--middle" cx="12" cy="12" r="3" />
        <circle className="huginn-thinking-dot huginn-thinking-dot--last" cx="20" cy="12" r="3" />
      </svg>
      <span
        aria-hidden="true"
        className="huginn-thinking-phase min-w-0 truncate text-[var(--text-secondary)]"
        key={phase}
      >
        {phase}
      </span>
    </div>
  );
}
