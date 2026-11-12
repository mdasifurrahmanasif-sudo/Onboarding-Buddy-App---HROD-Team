import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAdminAccess } from "@/lib/auth/admin";
import { setWorkingJourney } from "@/actions/admin-access";

const ROLE_LABEL = { super_admin: "Super admin", journey_admin: "Journey admin", hrbp: "HRBP" } as const;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const access = await getAdminAccess();
  if (!access) redirect("/home");

  const supabase = await createClient();
  const { data: variants } = await supabase
    .from("onboarding_variants")
    .select("id, name, nav_mode, is_default")
    .order("is_default", { ascending: false });
  const variant = variants?.find((v) => v.id === access.variantId);

  // Content pages edit one journey; HRBPs never get them, and a super admin
  // needs a working journey picked first.
  const canEditContent = access.role !== "hrbp" && Boolean(variant);
  const sections: { title: string; links: { href: string; label: string; show?: boolean }[] }[] = [
    { title: "People", links: [{ href: "/admin/people", label: "People" }] },
    {
      title: variant ? `Journey · ${variant.name}` : "Journey",
      links: canEditContent
        ? [
            { href: "/admin/tasks", label: "Tasks" },
            { href: "/admin/resources", label: "Resources" },
            { href: "/admin/contacts", label: "Contacts" },
            { href: "/admin/issue-types", label: "Issue types" },
            { href: "/admin/journeys", label: "Journeys", show: variant?.is_default === false },
            { href: "/admin/assessments", label: "Assessments", show: variant?.is_default === false },
            { href: "/admin/completions", label: "Completions", show: variant?.is_default === false },
            { href: "/admin/notifications", label: "Notifications", show: variant?.nav_mode === "resources" },
          ]
        : [],
    },
    {
      title: "System",
      links:
        access.role === "super_admin"
          ? [
              { href: "/admin/admins", label: "Admins" },
              { href: "/super-admin/notifications", label: "Broadcast" },
            ]
          : [],
    },
  ];

  return (
    <div data-admin-site className="flex min-h-dvh flex-col md:flex-row">
      <aside className="border-b border-line bg-card p-4 md:w-60 md:shrink-0 md:border-b-0 md:border-r">
        <div className="font-en text-lg font-extrabold text-text">Onboarding Admin</div>
        <div className="mb-4 text-[13px] font-medium text-muted">
          {ROLE_LABEL[access.role]}
          {access.role === "hrbp" && ` · ${access.sbus.join(", ")}`}
        </div>

        {access.role === "super_admin" && (
          <form action={setWorkingJourney} className="mb-4 flex gap-2">
            <select
              name="variantId"
              defaultValue={access.variantId ?? ""}
              aria-label="Working journey"
              className="min-w-0 flex-1 rounded-lg border border-line bg-bg px-2 py-1.5 text-[13px] text-text"
            >
              <option value="" disabled>
                Pick a journey…
              </option>
              {variants?.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
            <button type="submit" className="rounded-lg bg-green px-2.5 py-1.5 font-en text-[13px] font-bold text-white">
              Use
            </button>
          </form>
        )}

        <nav className="flex flex-col gap-4">
          {sections
            .map((s) => ({ ...s, links: s.links.filter((l) => l.show !== false) }))
            .filter((s) => s.links.length > 0)
            .map((s) => (
              <div key={s.title}>
                <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-muted">{s.title}</div>
                <div className="flex flex-wrap gap-1 md:flex-col">
                  {s.links.map((l) => (
                    <Link
                      key={l.href}
                      href={l.href}
                      className="rounded-lg px-2.5 py-1.5 font-en text-[13.5px] font-semibold text-text hover:bg-bg"
                    >
                      {l.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          <Link href="/home" className="px-2.5 font-en text-[13px] font-semibold text-muted">
            ← Back to app
          </Link>
        </nav>
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-8">
        <div className="mx-auto max-w-3xl">{children}</div>
      </main>
    </div>
  );
}
