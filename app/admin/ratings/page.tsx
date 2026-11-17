import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { canSeeEmployee, getAdminAccess } from "@/lib/auth/admin";
import { mapOnboardingVariant, resolveVariantForSbu } from "@/lib/onboarding-variant";
import { CHECKIN_MOODS, RATING_FACES } from "@/lib/day-ratings";

/**
 * Anonymous by design: employees are told their name is never shown with a
 * rating, so this page shows only totals and comments — never who wrote them.
 */
export default async function DayRatingsAdminPage() {
  const access = await getAdminAccess();
  if (!access) redirect("/home");

  const admin = createAdminClient();
  const [{ data: ratings }, { data: employees }, { data: variantsData }, { data: checkinRows }] = await Promise.all([
    // shortcut: loads every rating in one query, fine for thousands of rows; paginate if it grows past ~50k
    admin.from("day_ratings").select("enroll_number, day_number, rating, comment, rated_at").order("rated_at", { ascending: false }).limit(50000),
    admin.from("employees").select("enroll_number, sbu").limit(10000),
    admin.from("onboarding_variants").select("*"),
    admin.from("checkins").select("enroll_number, day_number, mood, comment, answered_at").order("answered_at", { ascending: false }).limit(50000),
  ]);
  const variants = (variantsData ?? []).map(mapOnboardingVariant);
  const sbuOf = new Map((employees ?? []).map((e) => [e.enroll_number, e.sbu]));
  const canSee = (enroll: string) => {
    const sbu = sbuOf.get(enroll) ?? null;
    return canSeeEmployee(access, { sbu }, resolveVariantForSbu(sbu, variants).id);
  };
  const visible = (ratings ?? []).filter((r) => canSee(r.enroll_number));
  const checkins = (checkinRows ?? []).filter((c) => canSee(c.enroll_number));
  const moodLabel = (m: string) => CHECKIN_MOODS.find((x) => x.value === m)?.label ?? m;
  const checkinDays = [15, 30, 45, 60].map((d) => {
    const xs = checkins.filter((c) => c.day_number === d);
    return { day: d, n: xs.length, ...Object.fromEntries(CHECKIN_MOODS.map((m) => [m.value, xs.filter((c) => c.mood === m.value).length])) } as { day: number; n: number; good: number; mixed: number; bad: number };
  });
  const checkinComments = checkins.filter((c) => c.comment?.trim()).slice(0, 200);

  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const overall = avg(visible.map((r) => r.rating));
  const people = new Set(visible.map((r) => r.enroll_number)).size;
  const byValue = RATING_FACES.map((f) => ({ ...f, n: visible.filter((r) => r.rating === f.value).length }));
  const byDay = [...new Set(visible.map((r) => r.day_number))]
    .sort((a, b) => a - b)
    .map((d) => {
      const xs = visible.filter((r) => r.day_number === d).map((r) => r.rating);
      return { day: d, n: xs.length, avg: avg(xs), low: xs.filter((x) => x < 4).length };
    });
  const comments = visible.filter((r) => r.comment?.trim()).slice(0, 200);

  return (
    <div>
      <h1 className="font-en text-xl font-bold text-text">Day Ratings</h1>
      <p className="mb-4 text-sm font-medium text-muted">
        How new joiners rate each onboarding day. Anonymous: names are never shown here.
      </p>

      <div className="mb-4 grid grid-cols-3 gap-3">
        {[
          ["Average rating", visible.length ? `${overall.toFixed(2)} / 5` : "—"],
          ["Ratings given", String(visible.length)],
          ["People rating", String(people)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-card border border-line bg-card p-4 shadow-card">
            <div className="text-[11px] font-bold uppercase tracking-wide text-muted">{label}</div>
            <div className="mt-1 font-en text-2xl font-extrabold text-green-dark">{value}</div>
          </div>
        ))}
      </div>

      <div className="mb-4 rounded-card border border-line bg-card p-4 shadow-card">
        <div className="mb-2 font-en text-[15px] font-bold text-text">Spread</div>
        {byValue.map((f) => (
          <div key={f.value} className="mb-1.5 flex items-center gap-2 text-[13px]">
            <span className="w-28 shrink-0">
              {f.emoji} {f.label}
            </span>
            <div className="h-2.5 flex-1 overflow-hidden rounded bg-[#edeff2]">
              <div className="h-full rounded bg-green" style={{ width: `${visible.length ? (f.n / visible.length) * 100 : 0}%` }} />
            </div>
            <span className="w-10 text-right font-semibold text-muted">{f.n}</span>
          </div>
        ))}
      </div>

      <div className="mb-4 overflow-x-auto rounded-card border border-line bg-card shadow-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-[12px] uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-2">Onboarding day</th>
              <th className="px-3 py-2 text-right">Ratings</th>
              <th className="px-3 py-2 text-right">Average</th>
              <th className="px-3 py-2 text-right">Below 4</th>
            </tr>
          </thead>
          <tbody>
            {byDay.map((d) => (
              <tr key={d.day} className="border-b border-line last:border-0">
                <td className="px-3 py-2 font-semibold text-text">Day {d.day}</td>
                <td className="px-3 py-2 text-right text-muted">{d.n}</td>
                <td className="px-3 py-2 text-right font-en font-bold text-green-dark">{d.avg.toFixed(2)}</td>
                <td className={`px-3 py-2 text-right font-semibold ${d.low ? "text-err-tx" : "text-muted"}`}>{d.low}</td>
              </tr>
            ))}
            {byDay.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-center text-muted">
                  No ratings yet. The first reminder goes out at 5 pm.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <h2 className="mb-2 mt-8 font-en text-lg font-bold text-text">15-day check-ins</h2>
      <div className="mb-4 overflow-x-auto rounded-card border border-line bg-card shadow-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-[12px] uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-2">Check-in</th>
              <th className="px-3 py-2 text-right">Answers</th>
              <th className="px-3 py-2 text-right">All good</th>
              <th className="px-3 py-2 text-right">A few things</th>
              <th className="px-3 py-2 text-right">Not great</th>
            </tr>
          </thead>
          <tbody>
            {checkinDays.map((d) => (
              <tr key={d.day} className="border-b border-line last:border-0">
                <td className="px-3 py-2 font-semibold text-text">Day {d.day}</td>
                <td className="px-3 py-2 text-right text-muted">{d.n}</td>
                <td className="px-3 py-2 text-right text-green-dark">{d.good}</td>
                <td className="px-3 py-2 text-right text-muted">{d.mixed}</td>
                <td className={`px-3 py-2 text-right font-semibold ${d.bad ? "text-err-tx" : "text-muted"}`}>{d.bad}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mb-2 font-en text-[15px] font-bold text-text">What people shared at check-ins ({checkinComments.length})</div>
      <div className="mb-8 flex flex-col gap-2">
        {checkinComments.map((c, i) => (
          <div key={i} className="rounded-card border border-line bg-card p-3.5 shadow-card">
            <div className="text-[11.5px] font-semibold text-muted">
              {moodLabel(c.mood)} · Day {c.day_number} · {new Date(c.answered_at).toLocaleDateString("en-GB")}
            </div>
            <div className="mt-1 text-[13px] text-text">{c.comment}</div>
          </div>
        ))}
        {checkinComments.length === 0 && (
          <div className="rounded-card border border-line bg-card p-4 text-center text-sm text-muted">Nothing shared yet.</div>
        )}
      </div>

      <div className="mb-2 font-en text-[15px] font-bold text-text">What people shared after a low day rating ({comments.length})</div>
      <div className="flex flex-col gap-2">
        {comments.map((c, i) => (
          <div key={i} className="rounded-card border border-line bg-card p-3.5 shadow-card">
            <div className="text-[11.5px] font-semibold text-muted">
              {RATING_FACES[c.rating - 1].emoji} {RATING_FACES[c.rating - 1].label} · Day {c.day_number} ·{" "}
              {new Date(c.rated_at).toLocaleDateString("en-GB")}
            </div>
            <div className="mt-1 text-[13px] text-text">{c.comment}</div>
          </div>
        ))}
        {comments.length === 0 && (
          <div className="rounded-card border border-line bg-card p-4 text-center text-sm text-muted">Nothing shared yet.</div>
        )}
      </div>
    </div>
  );
}
