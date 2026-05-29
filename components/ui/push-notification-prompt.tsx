"use client";

import { useEffect, useState } from "react";

const DISMISS_KEY = "odim-push-dismissed";

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

export function PushNotificationPrompt() {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [dismissed, setDismissed] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator);
    setPermission(typeof window !== "undefined" && "Notification" in window ? Notification.permission : "default");
    setDismissed(window.localStorage.getItem(DISMISS_KEY) === "true");
  }, []);

  useEffect(() => {
    if (!supported || permission !== "granted") return;
    let active = true;
    void (async () => {
      const registration = await ensureServiceWorker();
      if (!registration || !active) return;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await fetch("/api/push-subscribe", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(subscription.toJSON())
        });
      }
    })();
    return () => {
      active = false;
    };
  }, [supported, permission]);

  if (!supported || permission === "granted" || dismissed) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-[65] max-w-sm rounded-[var(--radius-md)] p-3"
      style={{ background: "var(--ink-800)", border: "1px solid var(--line-faint)", boxShadow: "var(--shadow-lg)" }}
    >
      <div className="text-[13px]" style={{ color: "var(--text-primary)" }}>
        Critical alerts can be surfaced in the browser.
      </div>
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={async () => {
            setBusy(true);
            try {
              const next = await Notification.requestPermission();
              setPermission(next);
              if (next === "granted") {
                const registration = await ensureServiceWorker();
                if (!registration) return;
                const response = await fetch("/api/push-subscribe");
                if (!response.ok) return;
                const payload = (await response.json()) as { publicKey?: string | null };
                if (!payload.publicKey) return;
                const subscription = await registration.pushManager.subscribe({
                  userVisibleOnly: true,
                  applicationServerKey: decodeBase64Url(payload.publicKey)
                });
                await fetch("/api/push-subscribe", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify(subscription.toJSON())
                });
              }
            } finally {
              setBusy(false);
            }
          }}
          className="mono rounded px-2.5 py-1.5 text-[10px] uppercase tracking-[0.1em]"
          style={{ background: "var(--rune-wash)", border: "1px solid rgba(201,169,97,0.2)", color: "var(--rune)" }}
          disabled={busy}
        >
          {busy ? "..." : "Enable"}
        </button>
        <button
          type="button"
          onClick={() => {
            window.localStorage.setItem(DISMISS_KEY, "true");
            setDismissed(true);
          }}
          className="mono rounded px-2.5 py-1.5 text-[10px] uppercase tracking-[0.1em]"
          style={{ background: "var(--surface-secondary)", border: "1px solid var(--line-faint)", color: "var(--text-tertiary)" }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
