import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { canSeeEmployee, getAdminAccess } from "@/lib/auth/admin";
import { mapOnboardingVariant, resolveVariantForSbu } from "@/lib/onboarding-variant";
import { CHECKIN_MOODS, RATING_FACES } from "@/lib/day-ratings";

/**
 * Who is having a good or bad onboarding experience. Employees are told their
 * answers are confidential to HR (never their manager), so this page is only
 * for admins/HRBPs, each limited to the people they can already see.
 */
export default async function ExperienceAdminPage() {
  const access = await getAdminAccess();
  if (!access) redirect("/home");

  const admin = createAdminClient();
  const [{ data: ratingRows }, { data: checkinRows }, { data: employees }, { data: variantsData }] = await Promise.all([
    // shortcut: loads every row in one query, fine for thousands; paginate past ~50k
    admin.from("day_ratings").select("enroll_number, day_number, rating, comment, rated_at").order("rated_at", { ascending: false }).limit(50000),
    admin.from("checkins").select("enroll_number, day_number, mood, comment, answered_at").order("answered_at", { ascending: false }).limit(50000),
    admin.from("employees").select("enroll_number, name, sbu, designation").limit(10000),
    admin.from("onboarding_variants").select("*"),
  ]);
  const variants = (variantsData ?? []).map(mapOnboardingVariant);
  const emp = new Map((employees ?? []).map((e) => [e.enroll_number, e]));
  const canSee = (enroll: string) => {
    const sbu = emp.get(enroll)?.sbu ?? null;
    return canSeeEmployee(access, { sbu }, resolveVariantForSbu(sbu, variants).id);
  };
  const ratings = (ratingRows ?? []).filter((r) => canSee(r.enroll_number));
  const checkins = (checkinRows ?? []).filter((c) => canSee(c.enroll_number));

  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const face = (r: number) => RATING_FACES[Math.min(5, Math.max(1, Math.round(r))) - 1];
  const moodLabel = (m: string) => CHECKIN_MOODS.find((x) => x.value === m)?.label ?? m;

  // One row per person: average, latest rating, low days, latest check-in.
  const enrolls = [...new Set([...ratings.map((r) => r.enroll_number), ...checkins.map((c) => c.enroll_number)])];
  const people = enrolls
    .map((enroll) => {
      const rs = ratings.filter((r) => r.enroll_number === enroll); // newest first
      const cs = checkins.filter((c) => c.enroll_number === enroll);
      const a = rs.length ? avg(rs.map((r) => r.rating)) : null;
      const lastCheckin = cs[0];
      const needsHelp = (a !== null && a < 3) || rs[0]?.rating < 3 || lastCheckin?.mood === "bad";
      return {
        enroll,
        name: emp.get(enroll)?.name ?? enroll,
        sub: [emp.get(enroll)?.designation, emp.get(enroll)?.sbu].filter(Boolean).join(" · "),
        avg: a,
        last: rs[0],
        lowDays: rs.filter((r) => r.rating < 4).length,
        rated: rs.length,
        checkin: lastCheckin,
        needsHelp,
        shared: rs.filter((r) => r.comment?.trim()).length + cs.filter((c) => c.comment?.trim()).length,
      };
    })
    // Needs help first, then lowest average.
    .sort((x, y) => Number(y.needsHelp) - Number(x.needsHelp) || (x.avg ?? 9) - (y.avg ?? 9));

  const comments = [
    ...ratings.filter((r) => r.comment?.trim()).map((r) => ({ enroll: r.enroll_number, when: r.rated_at, what: `${face(r.rating).emoji} ${face(r.rating).label} · Day ${r.day_number} rating`, text: r.comment! })),
    ...checkins.filter((c) => c.comment?.trim()).map((c) => ({ enroll: c.enroll_number, when: c.answered_at, what: `${moodLabel(c.mood)} · Day ${c.day_number} check-in`, text: c.comment! })),
  ]
    .sort((a, b) => b.when.localeCompare(a.when))
    .slice(0, 200);

  const byDay = [...new Set(ratings.map((r) => r.day_number))]
    .sort((a, b) => a - b)
    .map((d) => {
      const xs = ratings.filter((r) => r.day_number === d).map((r) => r.rating);
      return { day: d, n: xs.length, avg: avg(xs), low: xs.filter((x) => x < 4).length };
    });
  const helpCount = people.filter((p) => p.needsHelp).length;

  return (
    <div>
      <h1 className="font-en text-xl font-bold text-text">Experience</h1>
      <p className="mb-4 text-sm font-medium text-muted">
        How new joiners rate their days and answer the 15-day check-ins. Confidential: share with HR only, never with
        their manager.
      </p>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Need help", String(helpCount)],
          ["Average rating", ratings.length ? `${avg(ratings.map((r) => r.rating)).toFixed(2)} / 5` : "—"],
          ["People answering", String(people.length)],
          ["Ratings given", String(ratings.length)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-card border border-line bg-card p-4 shadow-card">
            <div className="text-[11px] font-bold uppercase tracking-wide text-muted">{label}</div>
            <div className={`mt-1 font-en text-2xl font-extrabold ${label === "Need help" && helpCount ? "text-err-tx" : "text-green-dark"}`}>{value}</div>
          </div>
        ))}
      </div>

      <h2 className="mb-2 font-en text-lg font-bold text-text">People</h2>
      <div className="mb-6 overflow-x-auto rounded-card border border-line bg-card shadow-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-[12px] uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-2">Person</th>
              <th className="px-3 py-2">Average</th>
              <th className="px-3 py-2">Latest day</th>
              <th className="px-3 py-2 text-right">Low days</th>
              <th className="px-3 py-2">Latest check-in</th>
            </tr>
          </thead>
          <tbody>
            {people.map((p) => (
              <tr key={p.enroll} className={`border-b border-line last:border-0 ${p.needsHelp ? "bg-err-bg/40" : ""}`}>
                <td className="px-3 py-2">
                  <Link href={`/admin/people/${p.enroll}`} className="font-semibold text-text hover:underline">
                    {p.name}
                  </Link>
                  {p.needsHelp && (
                    <span className="ml-2 rounded-full bg-err-bg px-2 py-0.5 text-[10.5px] font-bold text-err-tx">Needs help</span>
                  )}
                  <div className="text-xs text-muted">
                    {[p.enroll, p.sub].filter(Boolean).join(" · ")}
                    {p.shared > 0 && ` · shared ${p.shared} note${p.shared > 1 ? "s" : ""}`}
                  </div>
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {p.avg === null ? (
                    <span className="text-muted">—</span>
                  ) : (
                    <span className="font-en font-bold text-text">
                      {face(p.avg).emoji} {p.avg.toFixed(1)}
                    </span>
                  )}
                  <div className="text-xs text-muted">{p.rated} rated</div>
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-muted">
                  {p.last ? `${face(p.last.rating).emoji} Day ${p.last.day_number}` : "—"}
                </td>
                <td className={`px-3 py-2 text-right font-semibold ${p.lowDays ? "text-err-tx" : "text-muted"}`}>{p.lowDays}</td>
                <td className={`px-3 py-2 text-[13px] ${p.checkin?.mood === "bad" ? "font-semibold text-err-tx" : "text-muted"}`}>
                  {p.checkin ? `Day ${p.checkin.day_number}: ${moodLabel(p.checkin.mood)}` : "—"}
                </td>
              </tr>
            ))}
            {people.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-center text-muted">
                  No answers yet. Day ratings go out at 5 pm and check-ins at 10 am.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <h2 className="mb-2 font-en text-lg font-bold text-text">What people shared ({comments.length})</h2>
      <div className="mb-6 flex flex-col gap-2">
        {comments.map((c, i) => (
          <div key={i} className="rounded-card border border-line bg-card p-3.5 shadow-card">
            <div className="text-[12px] font-semibold text-muted">
              <Link href={`/admin/people/${c.enroll}`} className="font-bold text-text hover:underline">
                {emp.get(c.enroll)?.name ?? c.enroll}
              </Link>{" "}
              · {c.what} · {new Date(c.when).toLocaleDateString("en-GB")}
            </div>
            <div className="mt-1 text-[13px] text-text">{c.text}</div>
          </div>
        ))}
        {comments.length === 0 && (
          <div className="rounded-card border border-line bg-card p-4 text-center text-sm text-muted">Nothing shared yet.</div>
        )}
      </div>

      <h2 className="mb-2 font-en text-lg font-bold text-text">By onboarding day</h2>
      <div className="overflow-x-auto rounded-card border border-line bg-card shadow-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-[12px] uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-2">Day</th>
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
                  No ratings yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
