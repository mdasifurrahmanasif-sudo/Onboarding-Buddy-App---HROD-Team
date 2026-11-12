import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminAccess } from "@/lib/auth/admin";
import { removeAdminGrant, saveAdminGrant } from "@/actions/admin-access";

const ROLE_LABEL: Record<string, string> = { super_admin: "Super admin", journey_admin: "Journey admin", hrbp: "HRBP" };

export default async function AdminsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const access = await getAdminAccess();
  if (access?.role !== "super_admin") redirect("/admin");
  const { error } = await searchParams;

  const admin = createAdminClient();
  const [{ data: grants }, { data: variants }, { data: employees }, { data: profiles }] = await Promise.all([
    admin.from("admin_grants").select("*").order("role").order("enroll_number"),
    admin.from("onboarding_variants").select("id, name").order("is_default", { ascending: false }),
    // shortcut: one select caps at 1000 rows; page it once the roster passes ~1000.
    admin.from("employees").select("enroll_number, name, sbu").limit(1000),
    admin.from("profiles").select("enroll_number, full_name"),
  ]);

  const nameOf = new Map<string, string>();
  for (const p of profiles ?? []) nameOf.set(p.enroll_number, p.full_name);
  for (const e of employees ?? []) nameOf.set(e.enroll_number, e.name);
  const signedUp = new Set((profiles ?? []).map((p) => p.enroll_number));
  const variantName = new Map((variants ?? []).map((v) => [v.id, v.name]));
  const sbuOptions = [...new Set((employees ?? []).map((e) => e.sbu?.trim()).filter((s): s is string => Boolean(s)))].sort();

  const field = "w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-text";

  return (
    <div>
      <h1 className="font-en text-xl font-bold text-text">Admins</h1>
      <p className="mb-5 text-sm font-medium text-muted">
        Who can use this admin site. A role can be given before the person signs up; it applies on their first sign-in.
      </p>

      {error && (
        <div role="alert" className="mb-4 rounded-lg border border-[#f3c2c2] bg-[#fdf0f0] px-3 py-2 text-sm font-semibold text-[#b42318]">
          {error}
        </div>
      )}

      <div className="mb-8 overflow-x-auto rounded-card border border-line bg-card shadow-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-[12px] uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-2">Person</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Scope</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {(grants ?? []).map((g) => (
              <tr key={g.enroll_number} className="border-b border-line last:border-0">
                <td className="px-3 py-2">
                  <div className="font-semibold text-text">{nameOf.get(g.enroll_number) ?? "—"}</div>
                  <div className="text-xs text-muted">
                    {g.enroll_number}
                    {!signedUp.has(g.enroll_number) && " · not signed up yet"}
                  </div>
                </td>
                <td className="px-3 py-2 text-text">{ROLE_LABEL[g.role] ?? g.role}</td>
                <td className="px-3 py-2 text-muted">
                  {g.role === "hrbp"
                    ? g.sbus.join(", ")
                    : g.variant_id
                      ? variantName.get(g.variant_id)
                      : g.role === "super_admin"
                        ? "All journeys"
                        : "—"}
                </td>
                <td className="px-3 py-2 text-right">
                  {g.enroll_number !== access.enrollNumber && (
                    <form action={removeAdminGrant}>
                      <input type="hidden" name="enrollNumber" value={g.enroll_number} />
                      <button type="submit" className="text-[13px] font-semibold text-[#b42318]">
                        Remove
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
            {(grants ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-center text-muted">
                  No admins yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <h2 className="mb-3 font-en text-base font-bold text-text">Give or change a role</h2>
      <form action={saveAdminGrant} className="flex flex-col gap-4 rounded-card border border-line bg-card p-4 shadow-card">
        <label className="flex flex-col gap-1 text-sm font-semibold text-text">
          Enroll number
          <input name="enrollNumber" required className={field} placeholder="e.g. 571869" />
        </label>

        <label className="flex flex-col gap-1 text-sm font-semibold text-text">
          Role
          <select name="role" required defaultValue="" className={field}>
            <option value="" disabled>
              Pick a role…
            </option>
            <option value="hrbp">HRBP — sees people in the SBUs ticked below</option>
            <option value="journey_admin">Journey admin — edits one journey and sees its people</option>
            <option value="super_admin">Super admin — everything</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm font-semibold text-text">
          Journey <span className="font-normal text-muted">(journey admin; optional for super admin)</span>
          <select name="variantId" defaultValue="" className={field}>
            <option value="">—</option>
            {(variants ?? []).map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </label>

        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 text-sm font-semibold text-text">
            SBUs <span className="font-normal text-muted">(HRBP only)</span>
          </legend>
          <div className="grid max-h-56 grid-cols-1 gap-1 overflow-y-auto rounded-lg border border-line p-2 sm:grid-cols-2">
            {sbuOptions.map((s) => (
              <label key={s} className="flex items-center gap-2 text-[13px] text-text">
                <input type="checkbox" name="sbus" value={s} />
                {s}
              </label>
            ))}
          </div>
        </fieldset>

        <button type="submit" className="self-start rounded-button bg-green px-5 py-2.5 font-en text-sm font-bold text-white">
          Save role
        </button>
      </form>
    </div>
  );
}
