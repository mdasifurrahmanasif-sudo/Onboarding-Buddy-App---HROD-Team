"use client";

import { useEffect, useState } from "react";
import { savePushSubscription } from "@/actions/push";

const SNOOZE_KEY = "ob-push-snooze-until";
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

function toKey(base64: string) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function subscribe(publicKey: string) {
  const reg = await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: toKey(publicKey),
    }));
  await savePushSubscription(
    sub.toJSON() as Parameters<typeof savePushSubscription>[0],
  );
}

/** Gentle "turn on phone notifications" card: asks once, snoozes 7 days, explains iPhone. */
export function PushPrompt({ publicKey }: { publicKey: string | null }) {
  const [mode, setMode] = useState<"hidden" | "ask" | "ios">("hidden");

  useEffect(() => {
    if (!publicKey) return;
    // Short delay: let the page settle before asking (also keeps setState out of the effect body).
    const t = setTimeout(() => {
      let snoozed = false;
      try {
        snoozed = Number(localStorage.getItem(SNOOZE_KEY) ?? 0) > Date.now();
      } catch {}
      const supported =
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window;
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const standalone = window.matchMedia(
        "(display-mode: standalone)",
      ).matches;

      if (!supported) {
        // iPhone Safari tab: push only exists once the app is on the Home Screen.
        if (ios && !standalone && !snoozed) setMode("ios");
        return;
      }
      // Already allowed: silently (re)save this device — new phone or another user signed in.
      if (Notification.permission === "granted")
        subscribe(publicKey).catch(() => {});
      else if (Notification.permission === "default" && !snoozed)
        setMode("ask");
    }, 1500);
    return () => clearTimeout(t);
  }, [publicKey]);

  if (mode === "hidden") return null;

  const snooze = () => {
    try {
      localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS));
    } catch {}
    setMode("hidden");
  };
  const turnOn = async () => {
    setMode("hidden");
    if ((await Notification.requestPermission()) === "granted")
      await subscribe(publicKey!).catch(() => {});
  };

  return (
    <div
      role="dialog"
      aria-label="Phone notifications"
      className="fixed inset-x-4 bottom-24 z-40 mx-auto max-w-[400px] rounded-card border border-line bg-card p-4 shadow-modal"
    >
      <div className="font-en text-[15px] font-bold text-text">
        🔔 Turn on phone notifications
      </div>
      <p className="mt-1 text-[13px] font-medium text-muted">
        {mode === "ios"
          ? "On iPhone, first add the app: tap Share → Add to Home Screen, then open it from there."
          : "Get task reminders and messages from HR even when the app is closed."}
      </p>
      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={snooze}
          className="rounded-lg px-3 py-1.5 font-en text-[13px] font-semibold text-muted"
        >
          Not now
        </button>
        {mode === "ask" && (
          <button
            type="button"
            onClick={turnOn}
            className="rounded-lg bg-green px-3 py-1.5 font-en text-[13px] font-bold text-white"
          >
            Turn on
          </button>
        )}
      </div>
    </div>
  );
}
