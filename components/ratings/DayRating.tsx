"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { saveDayComment, saveDayRating } from "@/actions/day-ratings";
import { RATING_FACES } from "@/lib/day-ratings";

function Reassure() {
  return (
    <p className="mt-3 flex items-start gap-1.5 text-[11.5px] font-medium leading-snug text-muted">
      <span aria-hidden>🔒</span>
      <span>Confidential: only the HR team sees this, never your manager. It&apos;s only used to help you.</span>
    </p>
  );
}

/** Rating dialog → (if below 4) "want to share something?" → thank you. */
export function RatingDialog({ day, onClose }: { day: number; onClose: () => void }) {
  const router = useRouter();
  const [step, setStep] = useState<"rate" | "share" | "thanks">("rate");
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const [failed, setFailed] = useState(false);

  const close = () => {
    router.refresh();
    onClose();
  };
  const rate = async (value: number) => {
    setBusy(true);
    const { ok } = await saveDayRating(day, value);
    setBusy(false);
    if (!ok) return setFailed(true);
    setStep(value < 4 ? "share" : "thanks");
  };
  const share = async () => {
    setBusy(true);
    await saveDayComment(day, text);
    setBusy(false);
    setStep("thanks");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div role="dialog" aria-label={`Rate day ${day}`} className="w-full max-w-[400px] rounded-card bg-card p-5 shadow-modal">
        {step === "rate" && (
          <>
            <div className="text-[12px] font-bold uppercase tracking-wide text-muted">Day {day}</div>
            <div className="mt-0.5 font-en text-[17px] font-bold text-text">How was your day?</div>
            <div className="mt-4 flex justify-between gap-1">
              {RATING_FACES.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  disabled={busy}
                  onClick={() => rate(f.value)}
                  aria-label={`${f.value} - ${f.label}`}
                  className="flex flex-1 flex-col items-center gap-1 rounded-xl border border-line bg-bg py-2.5 transition-transform active:scale-95 disabled:opacity-50"
                >
                  <span className="text-[28px] leading-none">{f.emoji}</span>
                  <span className="text-[10.5px] font-semibold text-muted">{f.label}</span>
                </button>
              ))}
            </div>
            {failed && <p className="mt-2 text-[12px] font-semibold text-err-tx">Couldn&apos;t save. Please try again.</p>}
            <Reassure />
            <div className="mt-2 flex justify-end">
              <button type="button" onClick={onClose} className="rounded-lg px-3 py-1.5 font-en text-[13px] font-semibold text-muted">
                Later
              </button>
            </div>
          </>
        )}

        {step === "share" && (
          <>
            <div className="font-en text-[16px] font-bold text-text">Want to share something?</div>
            <p className="mt-1 text-[13px] font-medium text-muted">It might help us improve your experience.</p>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={1000}
              rows={4}
              aria-label="What could have gone better"
              placeholder="What made today hard? What could we do better?"
              className="mt-3 w-full rounded-xl border border-line bg-bg p-3 text-[13px] text-text"
            />
            <Reassure />
            <div className="mt-2 flex justify-end gap-2">
              <button type="button" onClick={() => setStep("thanks")} className="rounded-lg px-3 py-1.5 font-en text-[13px] font-semibold text-muted">
                Skip
              </button>
              <button
                type="button"
                disabled={busy || !text.trim()}
                onClick={share}
                className="rounded-lg bg-green px-4 py-1.5 font-en text-[13px] font-bold text-white disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </>
        )}

        {step === "thanks" && (
          <>
            <div className="text-center text-[34px]">🙏</div>
            <div className="mt-1 text-center font-en text-[16px] font-bold text-text">Thank you!</div>
            <p className="mt-1 text-center text-[13px] font-medium text-muted">Your answer helps make onboarding better.</p>
            <div className="mt-4 flex justify-center">
              <button type="button" onClick={close} className="rounded-lg bg-green px-5 py-2 font-en text-[13px] font-bold text-white">
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Opens today's rating by itself after 5 pm, once per day per device, if not rated yet. */
export function DayRatingPrompt({ day }: { day: number | null }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!day) return;
    const key = `ob-day-rating-asked-${day}`;
    // Wait for the install/notification setup card to be closed first.
    const t = setInterval(() => {
      if (document.querySelector('[aria-label="Set up the app"], [aria-label="Check-in"]')) return;
      clearInterval(t);
      try {
        if (sessionStorage.getItem(key)) return;
        sessionStorage.setItem(key, "1");
      } catch {}
      setOpen(true);
    }, 2500);
    return () => clearInterval(t);
  }, [day]);
  return open && day ? <RatingDialog day={day} onClose={() => setOpen(false)} /> : null;
}

/** "Rate" button for a missed day on the ratings page. */
export function RateDayButton({ day }: { day: number }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="rounded-lg bg-green px-3 py-1.5 font-en text-[12.5px] font-bold text-white">
        Rate Day {day}
      </button>
      {open && <RatingDialog day={day} onClose={() => setOpen(false)} />}
    </>
  );
}
