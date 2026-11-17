"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { saveCheckin } from "@/actions/day-ratings";
import { CHECKIN_MOODS, type CheckinMood } from "@/lib/day-ratings";

/** "Hey, just checking on you" — opens by itself on the app when a check-in is due, once per session. */
export function CheckinPrompt({ day }: { day: number | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mood, setMood] = useState<CheckinMood | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!day) return;
    const key = `ob-checkin-asked-${day}`;
    // Wait for the install/notification setup card to close first.
    const t = setInterval(() => {
      if (document.querySelector('[aria-label="Set up the app"]')) return;
      clearInterval(t);
      try {
        if (sessionStorage.getItem(key)) return;
        sessionStorage.setItem(key, "1");
      } catch {}
      setOpen(true);
    }, 2000);
    return () => clearInterval(t);
  }, [day]);

  if (!open || !day) return null;

  const send = async () => {
    if (!mood) return setError("Pick how it's going first.");
    setBusy(true);
    const { ok } = await saveCheckin(day, mood, text);
    setBusy(false);
    if (!ok) return setError("Couldn't send. Please try again.");
    setDone(true);
  };
  const close = () => {
    setOpen(false);
    if (done) router.refresh();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div role="dialog" aria-label="Check-in" className="w-full max-w-[400px] rounded-card bg-card p-5 shadow-modal">
        {done ? (
          <>
            <div className="text-center text-[34px]">💚</div>
            <div className="mt-1 text-center font-en text-[16px] font-bold text-text">Thanks for telling us</div>
            <p className="mt-1 text-center text-[13px] font-medium text-muted">
              {mood === "bad"
                ? "HR will use this to make things easier for new joiners."
                : "Glad to hear it. We'll check in again in 15 days."}
            </p>
            <div className="mt-4 flex justify-center">
              <button type="button" onClick={close} className="rounded-lg bg-green px-5 py-2 font-en text-[13px] font-bold text-white">
                Done
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="text-[12px] font-bold uppercase tracking-wide text-muted">Day {day} check-in</div>
            <div className="mt-0.5 font-en text-[17px] font-bold text-text">Hey, just checking on you 👋</div>
            <p className="mt-1 text-[13px] font-medium text-muted">Are you doing fine? Is everything going all right?</p>

            <div className="mt-3 flex flex-col gap-2" role="radiogroup" aria-label="How it's going">
              {CHECKIN_MOODS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  role="radio"
                  aria-checked={mood === m.value}
                  onClick={() => {
                    setMood(m.value);
                    setError("");
                  }}
                  className={`rounded-xl border px-3.5 py-2.5 text-left text-[13.5px] font-semibold ${
                    mood === m.value ? "border-green bg-green-light text-green-dark" : "border-line bg-bg text-text"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <label className="mt-4 block text-[13px] font-semibold text-text">
              If you feel like sharing something, we&apos;re listening <span className="font-medium text-muted">(optional)</span>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={1000}
                rows={3}
                placeholder="Anything on your mind about work, your team or settling in"
                className="mt-1.5 w-full rounded-xl border border-line bg-bg p-3 text-[13px] font-normal text-text"
              />
            </label>
            {error && <p className="mt-1 text-[12px] font-semibold text-err-tx">{error}</p>}

            <p className="mt-3 flex items-start gap-1.5 text-[11.5px] font-medium leading-snug text-muted">
              <span aria-hidden>🔒</span>
              <span>Confidential: only the HR team sees this, never your manager. It&apos;s only used to help you.</span>
            </p>
            <div className="mt-2 flex justify-end gap-2">
              <button type="button" onClick={close} className="rounded-lg px-3 py-1.5 font-en text-[13px] font-semibold text-muted">
                Later
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={send}
                className="rounded-lg bg-green px-4 py-1.5 font-en text-[13px] font-bold text-white disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
