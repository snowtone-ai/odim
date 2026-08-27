"use client";

import { useEffect, useState } from "react";

const DISMISS_KEY = "odim-push-dismissed";

export type PushNotificationPromptLabels = {
  title: string;
  enable: string;
  dismiss: string;
  busy: string;
  denied?: string;
  error?: string;
  enabled?: string;
  retry?: string;
  close?: string;
};

const DEFAULT_LABELS: PushNotificationPromptLabels = {
  title: "Allow browser notifications for critical alerts?",
  enable: "Enable",
  dismiss: "Not now",
  busy: "Working…",
  denied: "Browser notification permission was not granted.",
  error: "Notifications could not be enabled. Please retry.",
  enabled: "Browser notifications are enabled.",
  retry: "Retry setup",
  close: "Close"
};

async function ensureServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  return navigator.serviceWorker.register("/push-sw.js");
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const raw = window.atob(padded);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

/**
 * Contextual, explicit opt-in only. The dashboard shell intentionally does
 * not render this component; Alerts or Settings should control `open` after
 * the user asks to configure notifications.
 */
export function PushNotificationPrompt({
  open = false,
  labels = DEFAULT_LABELS,
  onDismiss
}: Readonly<{
  open?: boolean;
  labels?: PushNotificationPromptLabels;
  onDismiss?: () => void;
}>) {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [dismissed, setDismissed] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    setSupported(typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator);
    setPermission(typeof window !== "undefined" && "Notification" in window ? Notification.permission : "default");
    setDismissed(window.localStorage.getItem(DISMISS_KEY) === "true");
  }, []);

  useEffect(() => {
    if (!open) return;
    // A persisted "Not now" suppresses unsolicited prompts, never an explicit
    // Notifications action initiated by the user.
    setDismissed(false);
    setError("");
    setFeedback("");
  }, [open]);

  useEffect(() => {
    if (!open || !supported || permission !== "granted") return;
    let active = true;
    void (async () => {
      try {
        const registration = await ensureServiceWorker();
        if (!registration || !active) return;
        const subscription = await registration.pushManager.getSubscription();
        if (!subscription) return;
        const response = await fetch("/api/push-subscribe", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(subscription.toJSON())
        });
        if (!response.ok) throw new Error(`Push subscription sync failed: ${response.status}`);
        if (active) setFeedback(labels.enabled ?? DEFAULT_LABELS.enabled!);
      } catch {
        if (active) setError(labels.error ?? DEFAULT_LABELS.error!);
      }
    })();
    return () => {
      active = false;
    };
  }, [labels.enabled, labels.error, open, supported, permission]);

  if (!open || !supported || dismissed) return null;

  return (
    <div
      className="fixed bottom-20 left-4 right-4 z-[65] border p-3 sm:bottom-4 sm:left-auto sm:right-4 sm:max-w-sm"
      role="region"
      aria-live="polite"
      aria-label={labels.title}
      style={{
        background: "var(--surface, var(--ink-800, #131d26))",
        borderColor: "var(--line-soft, rgba(255,255,255,.12))",
        color: "var(--text, var(--text-primary, #e8eff2))"
      }}
    >
      <div className="text-[13px] leading-5">{labels.title}</div>
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={async () => {
            setBusy(true);
            setError("");
            setFeedback("");
            try {
              const next = permission === "granted" ? permission : await Notification.requestPermission();
              setPermission(next);
              if (next !== "granted") {
                setError(labels.denied ?? DEFAULT_LABELS.denied!);
                return;
              }
              const registration = await ensureServiceWorker();
              if (!registration) throw new Error("Service worker registration unavailable");
              const response = await fetch("/api/push-subscribe");
              if (!response.ok) throw new Error(`Push key request failed: ${response.status}`);
              const payload = (await response.json()) as { publicKey?: string | null };
              if (!payload.publicKey) throw new Error("Push public key unavailable");
              const existingSubscription = await registration.pushManager.getSubscription();
              const subscription = existingSubscription ?? await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: decodeBase64Url(payload.publicKey)
              });
              const subscribeResponse = await fetch("/api/push-subscribe", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(subscription.toJSON())
              });
              if (!subscribeResponse.ok) throw new Error(`Push subscription failed: ${subscribeResponse.status}`);
              setFeedback(labels.enabled ?? DEFAULT_LABELS.enabled!);
            } catch {
              setError(labels.error ?? DEFAULT_LABELS.error!);
            } finally {
              setBusy(false);
            }
          }}
          className="mono min-h-11 border px-3 py-2 text-[11px] uppercase tracking-[0.1em] transition-colors hover:bg-[color-mix(in_srgb,var(--signal,#4c90f0)_12%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--signal,#4c90f0)]"
          style={{
            background: "color-mix(in srgb, var(--signal, #4c90f0) 12%, transparent)",
            borderColor: "var(--signal, #4c90f0)",
            color: "var(--signal, #4c90f0)"
          }}
          disabled={busy || Boolean(feedback)}
        >
          {busy ? labels.busy : permission === "granted" ? labels.retry ?? DEFAULT_LABELS.retry : labels.enable}
        </button>
        <button
          type="button"
          onClick={() => {
            window.localStorage.setItem(DISMISS_KEY, "true");
            setDismissed(true);
            onDismiss?.();
          }}
          className="mono min-h-11 border px-3 py-2 text-[11px] uppercase tracking-[0.1em] transition-colors hover:bg-[color-mix(in_srgb,var(--signal,#4c90f0)_8%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--signal,#4c90f0)]"
          style={{
            background: "transparent",
            borderColor: "var(--line-soft, rgba(255,255,255,.12))",
            color: "var(--text-secondary, #8d97ab)"
          }}
        >
          {feedback ? labels.close ?? DEFAULT_LABELS.close : labels.dismiss}
        </button>
      </div>
      {feedback ? (
        <p className="mt-2 text-[12px] leading-5" role="status" style={{ color: "var(--evidence)" }}>
          {feedback}
        </p>
      ) : null}
      {error ? (
        <p className="mt-2 text-[12px] leading-5" role="alert" style={{ color: "var(--critical)" }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
