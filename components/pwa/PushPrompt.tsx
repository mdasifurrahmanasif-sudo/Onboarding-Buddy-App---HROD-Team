"use client";

import { useEffect, useState } from "react";
import { savePushSubscription } from "@/actions/push";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// Shown once per app open (browser session) until both steps are done.
const SEEN_KEY = "ob-setup-card-seen-v2"; // bumped so everyone sees it once now that push is live

function toKey(base64: string) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function subscribe(publicKey: string) {
  const reg = await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(publicKey) }));
  await savePushSubscription(sub.toJSON() as Parameters<typeof savePushSubscription>[0]);
}

type NotifState = "on" | "off" | "blocked" | "needs-install" | "unsupported";

function readNotifState(): NotifState {
  if ("serviceWorker" in navigator && "PushManager" in window && "Notification" in window) {
    if (Notification.permission === "granted") return "on";
    return Notification.permission === "denied" ? "blocked" : "off";
  }
  // iPhone Safari tab: push only exists once the app is on the Home Screen.
  return /iphone|ipad|ipod/i.test(navigator.userAgent) ? "needs-install" : "unsupported";
}

function Tick() {
  return (
    <span aria-label="Done" className="grid h-7 w-7 place-items-center rounded-full bg-green text-[15px] font-bold text-white">
      ✓
    </span>
  );
}

/** App-open card with two steps: install the app, turn on phone notifications. Done steps show a green tick. */
export function PushPrompt({ publicKey }: { publicKey: string | null }) {
  const [open, setOpen] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [notif, setNotif] = useState<NotifState>("unsupported");
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showSteps, setShowSteps] = useState(false);

  useEffect(() => {
    const onBip = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener("appinstalled", onInstalled);

    // Short delay: let the page settle first.
    const t = setTimeout(() => {
      const isInstalled = window.matchMedia("(display-mode: standalone)").matches;
      const n = readNotifState();
      setInstalled(isInstalled);
      setNotif(n);
      // Already allowed: silently (re)save this device — new phone or another user signed in.
      if (n === "on" && publicKey) subscribe(publicKey).catch(() => {});

      const notifDone = !publicKey || n === "on" || n === "unsupported";
      let seen = false;
      try {
        seen = sessionStorage.getItem(SEEN_KEY) === "1";
        sessionStorage.setItem(SEEN_KEY, "1");
      } catch {}
      if (!seen && !(isInstalled && notifDone)) setOpen(true);
    }, 1500);

    return () => {
      clearTimeout(t);
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [publicKey]);

  if (!open) return null;

  const install = async () => {
    if (!installEvent) return setShowSteps((v) => !v);
    await installEvent.prompt();
    if ((await installEvent.userChoice).outcome === "accepted") setInstalled(true);
    setInstallEvent(null);
  };
  const turnOn = async () => {
    const p = await Notification.requestPermission();
    setNotif(p === "granted" ? "on" : p === "denied" ? "blocked" : "off");
    if (p === "granted" && publicKey) await subscribe(publicKey).catch(() => {});
  };

  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const allDone = installed && (!publicKey || notif === "on" || notif === "unsupported");
  const row = "flex items-center justify-between gap-3 rounded-xl border border-line bg-bg p-3";
  const btn = "shrink-0 rounded-lg bg-green px-3 py-1.5 font-en text-[13px] font-bold text-white";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div role="dialog" aria-label="Set up the app" className="w-full max-w-[400px] rounded-card bg-card p-4 shadow-modal">
        <div className="font-en text-[16px] font-bold text-text">Get the most out of Onboarding Buddy</div>
        <div className="mt-3 flex flex-col gap-2">
          <div className={row}>
            <div>
              <div className="font-en text-[14px] font-semibold text-text">📲 Install the app</div>
              <div className="text-[12px] font-medium text-muted">{installed ? "Already installed" : "Open it from your home screen"}</div>
            </div>
            {installed ? <Tick /> : <button type="button" onClick={install} className={btn}>Install</button>}
          </div>
          {showSteps && !installed && (
            <p className="rounded-xl border border-line p-3 text-[12.5px] font-medium text-muted">
              {ios
                ? 'Tap the Share icon, then choose "Add to Home Screen".'
                : 'Open the browser menu (⋮) and choose "Install app" or "Add to Home Screen".'}
            </p>
          )}

          {publicKey && notif !== "unsupported" && (
            <div className={row}>
              <div>
                <div className="font-en text-[14px] font-semibold text-text">🔔 Turn on notifications</div>
                <div className="text-[12px] font-medium text-muted">
                  {notif === "on"
                    ? "Already on"
                    : notif === "blocked"
                      ? "Blocked — allow it in your browser's site settings"
                      : notif === "needs-install"
                        ? "On iPhone, install the app first, then open it from the home screen"
                        : "Reminders and HR messages, even when the app is closed"}
                </div>
              </div>
              {notif === "on" ? <Tick /> : notif === "off" && <button type="button" onClick={turnOn} className={btn}>Turn on</button>}
            </div>
          )}
        </div>
        <div className="mt-3 flex justify-end">
          <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-3 py-1.5 font-en text-[13px] font-semibold text-muted">
            {allDone ? "Done" : "Later"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Always-available Profile button: turn notifications on, or show they're on. */
export function NotificationButton({ publicKey, bn }: { publicKey: string | null; bn?: boolean }) {
  const [notif, setNotif] = useState<NotifState | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setNotif(readNotifState()), 0);
    return () => clearTimeout(t);
  }, []);
  if (!publicKey || notif === null) return null;

  const turnOn = async () => {
    const p = await Notification.requestPermission();
    setNotif(p === "granted" ? "on" : p === "denied" ? "blocked" : "off");
    if (p === "granted") await subscribe(publicKey).catch(() => {});
  };
  const note =
    notif === "blocked"
      ? bn
        ? "নোটিফিকেশন ব্লক করা আছে — ব্রাউজারের সাইট সেটিংস থেকে Allow করুন।"
        : "Notifications are blocked — allow them in your browser's site settings."
      : notif === "needs-install"
        ? bn
          ? "iPhone-এ আগে অ্যাপটি Home Screen-এ যোগ করুন, তারপর সেখান থেকে খুলুন।"
          : "On iPhone, add the app to your Home Screen first, then open it from there."
        : bn
          ? "এই ব্রাউজারে নোটিফিকেশন সাপোর্ট করে না — Chrome বা Safari-তে খুলুন।"
          : "This browser can't show notifications — open the app in Chrome or Safari.";

  return (
    <div className="mt-3">
      {notif === "on" ? (
        <div className="flex items-center justify-center gap-2 rounded-button border border-line bg-card px-4 py-3.5 font-en text-sm font-bold text-green-dark">
          <Tick /> {bn ? "নোটিফিকেশন চালু আছে" : "Notifications are on"}
        </div>
      ) : notif === "off" ? (
        <button
          type="button"
          onClick={turnOn}
          className="w-full rounded-button bg-green px-4 py-3.5 font-en text-sm font-bold text-white active:scale-[0.98]"
        >
          🔔 {bn ? "নোটিফিকেশন চালু করুন" : "Turn on notifications"}
        </button>
      ) : (
        <p className="rounded-xl border border-line bg-card p-3.5 text-[12.5px] font-medium text-muted">{note}</p>
      )}
    </div>
  );
}
