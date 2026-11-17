import { redirect } from "next/navigation";
import { BackButton } from "@/components/ui/BackButton";
import { RateDayButton } from "@/components/ratings/DayRating";
import { getMyRatings } from "@/lib/data/day-ratings";
import { dateOfRatingDay, MAX_RATING_DAYS, RATING_FACES } from "@/lib/day-ratings";

const face = (r: number) => RATING_FACES[Math.min(5, Math.max(1, Math.round(r))) - 1];

export default async function RatingsPage() {
  const mine = await getMyRatings();
  if (!mine) redirect("/login");

  const w = mine.window;
  // In the window: every rateable day, newest first. Afterwards: just the days they rated.
  const days = w
    ? Array.from({ length: w.today - w.firstDay + 1 }, (_, i) => w.today - i)
    : [...mine.ratings.keys()].sort((a, b) => b - a);
  const values = [...mine.ratings.values()].map((r) => r.rating);
  const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  const missed = days.filter((d) => !mine.ratings.has(d)).length;
  const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

  return (
    <div>
      <div className="mb-4 mt-0.5 flex items-center gap-3">
        <BackButton fallbackHref="/profile" />
        <div className="font-en text-lg font-extrabold text-text">My Day Ratings</div>
      </div>

      <div className="mb-4 rounded-card border border-line bg-card p-5 text-center shadow-card">
        <div className="text-[12px] font-bold uppercase tracking-wide text-muted">Overall onboarding experience</div>
        {avg === null ? (
          <div className="mt-2 text-[14px] font-medium text-muted">
            {w
              ? "No ratings yet. Rate your first day below."
              : `Day ratings are for new joiners during their first ${MAX_RATING_DAYS} days.`}
          </div>
        ) : (
          <>
            <div className="mt-1 text-[44px] leading-none">{face(avg).emoji}</div>
            <div className="mt-1 font-en text-[28px] font-extrabold text-green-dark">
              {avg.toFixed(1)}
              <span className="text-[15px] font-bold text-muted"> / 5</span>
            </div>
            <div className="text-[13px] font-semibold text-text">{face(avg).label}</div>
          </>
        )}
        {w && (
          <div className="mt-2 text-[12px] font-medium text-muted">
            Day {w.today} of {MAX_RATING_DAYS} · {values.length} rated{missed > 0 && ` · ${missed} to catch up`}
          </div>
        )}
        <p className="mt-3 text-[11.5px] font-medium text-muted">🔒 Confidential: only the HR team sees your ratings, never your manager.</p>
      </div>

      <div className="flex flex-col gap-2">
        {days.map((d) => {
          const r = mine.ratings.get(d);
          return (
            <div key={d} className="flex items-center justify-between rounded-card border border-line bg-card px-4 py-3 shadow-card">
              <div>
                <div className="font-en text-[14px] font-bold text-text">
                  Day {d}
                  {d === w?.today && <span className="ml-1.5 text-[11px] font-semibold text-green-dark">Today</span>}
                </div>
                {w && <div className="text-[11.5px] font-medium text-muted">{fmt(dateOfRatingDay(w.start, d))}</div>}
              </div>
              {r ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-[24px] leading-none">{face(r.rating).emoji}</span>
                  <span className="text-[12.5px] font-semibold text-muted">{face(r.rating).label}</span>
                </div>
              ) : w ? (
                <RateDayButton day={d} />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
