import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { canSeeEmployee, getAdminAccess } from "@/lib/auth/admin";
import { mapOnboardingVariant, resolveVariantForSbu } from "@/lib/onboarding-variant";
import { isTestEmployee } from "@/lib/test-employees";
import { dhakaDate } from "@/lib/day-ratings";

const PAGE_SIZE = 1000;
const LOGIN_FILTERS = [
  ["", "All"],
  ["today", "Today"],
  ["yesterday", "Yesterday"],
  ["7", "Last 7 days"],
  ["30", "Last 30 days"],
  ["60", "Last 60 days"],
  ["90", "Last 90 days"],
  ["never", "Never logged in"],
] as const;

/** Does a last-login time fall in the chosen filter? Dates are Dhaka calendar days. */
function matchesLogin(at: string | undefined, filter: string, now = new Date()): boolean {
  if (!filter) return true;
  if (filter === "never") return !at;
  if (!at) return false;
  const day = (offset: number) => dhakaDate(new Date(now.getTime() - offset * 86400000));
  const d = dhakaDate(at);
  if (filter === "today") return d === day(0);
  if (filter === "yesterday") return d === day(1);
  return d > day(Number(filter)); // last N days, today included
}

export default async function PeoplePage({ searchParams }: { searchParams: Promise<{ q?: string; login?: string }> }) {
  const access = await getAdminAccess();
  if (!access) redirect("/home");
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().toLowerCase();
  const login = LOGIN_FILTERS.some(([v]) => v === sp.login) ? sp.login! : "";

  // Service role: HRBPs have no RLS read on other employees; who may see whom
  // is decided by canSeeEmployee below.
  const admin = createAdminClient();
  const [{ data: allEmployees }, { data: variantsData }, { data: tasks }, { data: profiles }] = await Promise.all([
    admin.from("employees").select("enroll_number, name, sbu, designation, department, joining_date").limit(PAGE_SIZE),
    admin.from("onboarding_variants").select("*"),
    admin.from("onboarding_tasks").select("id, variant_id").eq("active", true),
    admin.from("profiles").select("id, enroll_number").limit(10000),
  ]);

  // Last sign-in comes from Supabase Auth (profiles.id = auth user id).
  const signInById = new Map<string, string>();
  for (let page = 1; ; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: PAGE_SIZE });
    for (const u of data?.users ?? []) if (u.last_sign_in_at) signInById.set(u.id, u.last_sign_in_at);
    if (!data || data.users.length < PAGE_SIZE) break;
  }
  const lastLogin = new Map((profiles ?? []).map((p) => [p.enroll_number, signInById.get(p.id)]));

  const variants = (variantsData ?? []).map(mapOnboardingVariant);
  const people = (allEmployees ?? [])
    .filter((e) => !isTestEmployee(e.enroll_number))
    .map((e) => ({ ...e, variant: resolveVariantForSbu(e.sbu, variants) }))
    .filter((e) => canSeeEmployee(access, e, e.variant.id))
    .filter((e) => !q || `${e.name} ${e.enroll_number} ${e.sbu ?? ""}`.toLowerCase().includes(q))
    .filter((e) => matchesLogin(lastLogin.get(e.enroll_number), login))
    .sort((a, b) => (b.joining_date ?? "").localeCompare(a.joining_date ?? ""));

  const taskVariant = new Map((tasks ?? []).map((t) => [t.id, t.variant_id]));
  const totalByVariant = new Map<string, number>();
  for (const v of taskVariant.values()) totalByVariant.set(v, (totalByVariant.get(v) ?? 0) + 1);

  // Count only tasks of each person's own journey (dual-track people have rows for two).
  const variantOf = new Map(people.map((p) => [p.enroll_number, p.variant.id]));
  const done = new Map<string, number>();
  const enrolls = people.map((p) => p.enroll_number);
  for (let i = 0; i < enrolls.length; i += 200) {
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data: page } = await admin
        .from("employee_task_status")
        .select("employee_enroll_number, task_id")
        .eq("done", true)
        .in("employee_enroll_number", enrolls.slice(i, i + 200))
        .range(from, from + PAGE_SIZE - 1);
      for (const s of page ?? []) {
        if (taskVariant.get(s.task_id) === variantOf.get(s.employee_enroll_number)) {
          done.set(s.employee_enroll_number, (done.get(s.employee_enroll_number) ?? 0) + 1);
        }
      }
      if (!page || page.length < PAGE_SIZE) break;
    }
  }

  return (
    <div>
      <h1 className="font-en text-xl font-bold text-text">People</h1>
      <p className="mb-4 text-sm font-medium text-muted">
        {people.length} {people.length === 1 ? "person" : "people"} you can see
        {access.role === "hrbp" && ` in ${access.sbus.join(", ").replace("*", "all SBUs")}`}.
      </p>

      <form className="mb-4">
        {login && <input type="hidden" name="login" value={login} />}
        <input
          name="q"
          defaultValue={q}
          aria-label="Search people"
          placeholder="Search by name, enroll or SBU"
          className="w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-text"
        />
      </form>

      <div className="mb-4 flex flex-wrap gap-1.5" aria-label="Filter by last login">
        <span className="self-center pr-1 text-[12px] font-bold uppercase tracking-wide text-muted">Last login</span>
        {LOGIN_FILTERS.map(([v, label]) => (
          <Link
            key={v}
            href={{ pathname: "/admin/people", query: { ...(q && { q }), ...(v && { login: v }) } }}
            aria-current={login === v ? "true" : undefined}
            className={`rounded-full border px-3 py-1 font-en text-[12.5px] font-semibold ${
              login === v ? "border-green bg-green-light text-green-dark" : "border-line bg-card text-text hover:bg-bg"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      <div className="overflow-x-auto rounded-card border border-line bg-card shadow-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-[12px] uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">SBU</th>
              <th className="px-3 py-2">Journey</th>
              <th className="px-3 py-2">Joined</th>
              <th className="px-3 py-2">Last login</th>
              <th className="px-3 py-2 text-right">Progress</th>
            </tr>
          </thead>
          <tbody>
            {people.map((p) => {
              const total = totalByVariant.get(p.variant.id) ?? 0;
              const d = done.get(p.enroll_number) ?? 0;
              return (
                <tr key={p.enroll_number} className="border-b border-line last:border-0">
                  <td className="px-3 py-2">
                    <Link href={`/admin/people/${p.enroll_number}`} className="font-semibold text-text hover:underline">
                      {p.name}
                    </Link>
                    <div className="text-xs text-muted">
                      {[p.enroll_number, p.designation].filter(Boolean).join(" · ")}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-muted">{p.sbu ?? "—"}</td>
                  <td className="px-3 py-2 text-muted">{p.variant.name}</td>
                  <td className="px-3 py-2 text-muted">{p.joining_date ?? "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-muted">
                    {lastLogin.get(p.enroll_number)
                      ? new Date(lastLogin.get(p.enroll_number)!).toLocaleString("en-GB", { timeZone: "Asia/Dhaka", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
                      : "Never"}
                  </td>
                  <td className="px-3 py-2 text-right font-en font-bold text-green-dark">
                    {total > 0 ? `${Math.round((d / total) * 100)}%` : "—"}
                    <div className="text-xs font-medium text-muted">
                      {d}/{total}
                    </div>
                  </td>
                </tr>
              );
            })}
            {people.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-muted">
                  No one to show.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
