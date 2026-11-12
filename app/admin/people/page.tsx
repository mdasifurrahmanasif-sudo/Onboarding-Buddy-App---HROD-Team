import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { canSeeEmployee, getAdminAccess } from "@/lib/auth/admin";
import { mapOnboardingVariant, resolveVariantForSbu } from "@/lib/onboarding-variant";
import { isTestEmployee } from "@/lib/test-employees";

const PAGE_SIZE = 1000;

export default async function PeoplePage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const access = await getAdminAccess();
  if (!access) redirect("/home");
  const q = ((await searchParams).q ?? "").trim().toLowerCase();

  // Service role: HRBPs have no RLS read on other employees; who may see whom
  // is decided by canSeeEmployee below.
  const admin = createAdminClient();
  const [{ data: allEmployees }, { data: variantsData }, { data: tasks }] = await Promise.all([
    admin.from("employees").select("enroll_number, name, sbu, designation, department, joining_date").limit(PAGE_SIZE),
    admin.from("onboarding_variants").select("*"),
    admin.from("onboarding_tasks").select("id, variant_id").eq("active", true),
  ]);

  const variants = (variantsData ?? []).map(mapOnboardingVariant);
  const people = (allEmployees ?? [])
    .filter((e) => !isTestEmployee(e.enroll_number))
    .map((e) => ({ ...e, variant: resolveVariantForSbu(e.sbu, variants) }))
    .filter((e) => canSeeEmployee(access, e, e.variant.id))
    .filter((e) => !q || `${e.name} ${e.enroll_number} ${e.sbu ?? ""}`.toLowerCase().includes(q))
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
        {access.role === "hrbp" && ` in ${access.sbus.join(", ")}`}.
      </p>

      <form className="mb-4">
        <input
          name="q"
          defaultValue={q}
          aria-label="Search people"
          placeholder="Search by name, enroll or SBU"
          className="w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-text"
        />
      </form>

      <div className="overflow-x-auto rounded-card border border-line bg-card shadow-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-[12px] uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">SBU</th>
              <th className="px-3 py-2">Journey</th>
              <th className="px-3 py-2">Joined</th>
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
                    <Link href={`/employees/${p.enroll_number}`} className="font-semibold text-text hover:underline">
                      {p.name}
                    </Link>
                    <div className="text-xs text-muted">
                      {[p.enroll_number, p.designation].filter(Boolean).join(" · ")}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-muted">{p.sbu ?? "—"}</td>
                  <td className="px-3 py-2 text-muted">{p.variant.name}</td>
                  <td className="px-3 py-2 text-muted">{p.joining_date ?? "—"}</td>
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
                <td colSpan={5} className="px-3 py-4 text-center text-muted">
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
