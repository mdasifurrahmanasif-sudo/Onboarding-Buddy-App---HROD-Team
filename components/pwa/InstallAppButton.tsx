"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icons/Icon";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function getManualInstructions(isBn: boolean): string {
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isSafari = isIOS && /Safari/.test(ua) && !/CriOS|FxiOS/.test(ua);

  if (isSafari) {
    return isBn
      ? "নিচের Share আইকনে ট্যাপ করুন, তারপর \"Add to Home Screen\" বেছে নিন।"
      : 'Tap the Share icon below, then choose "Add to Home Screen".';
  }
  return isBn
    ? "ব্রাউজারের মেনু (⋮) খুলুন এবং \"Install app\" বা \"Add to Home Screen\" বেছে নিন।"
    : 'Open your browser\'s menu (⋮) and choose "Install app" or "Add to Home Screen".';
}

export function InstallAppButton({ bn: isBn }: { bn?: boolean }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [alreadyInstalled, setAlreadyInstalled] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) setAlreadyInstalled(true);

    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    }
    function onInstalled() {
      setDeferredPrompt(null);
      setAlreadyInstalled(true);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (alreadyInstalled) {
    return (
      <div className="mt-5 flex items-center justify-center gap-2 rounded-button border border-line bg-card px-4 py-3.5 font-en text-sm font-bold text-green-dark">
        <span className="grid h-6 w-6 place-items-center rounded-full bg-green text-[13px] text-white">✓</span>
        {isBn ? "অ্যাপ ইনস্টল করা আছে" : "App installed"}
      </div>
    );
  }

  async function handleClick() {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      return;
    }
    // No native prompt available (iOS Safari, Firefox, already dismissed,
    // or the browser just hasn't offered it yet) — show manual steps
    // instead of doing nothing, since this button should always do
    // something when tapped.
    setShowInstructions((v) => !v);
  }

  return (
    <div className="mt-5">
      <button
        type="button"
        onClick={handleClick}
        className="flex w-full items-center justify-center gap-2.5 rounded-button bg-green px-4 py-3.5 font-en text-sm font-bold text-white transition-transform active:scale-[0.98]"
      >
        <Icon name="monitor" size={16} />
        {isBn ? "অ্যাপ হিসেবে ইনস্টল করুন" : "Install as App"}
      </button>
      {showInstructions && !deferredPrompt && (
        <p className="mt-2.5 rounded-xl border border-line bg-card p-3.5 text-[12.5px] font-medium leading-snug text-muted">
          {getManualInstructions(Boolean(isBn))}
        </p>
      )}
    </div>
  );
}
