import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAdminVariantId, getAuthUser, getEmployeeVariant, getUnreadNotificationCount } from "@/lib/data/queries";
import { BottomNav } from "@/components/layout/BottomNav";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { PushPrompt } from "@/components/pwa/PushPrompt";

// Deliberately lightweight — only what every page under (app) needs
// (auth, nav flags, theme, bell badge). Anything that only exists to feed
// the task/help/contact/assessment overlay system lives one layout level
// deeper, in (overlay)/layout.tsx, scoped to just Home and Journey (the
// only pages that ever open one) — see that file for why.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await getAuthUser();

  if (!user) {
    redirect("/login");
  }

  const [variant, { data: isManagerData }, adminVariantId, unreadNotificationCount] = await Promise.all([
    getEmployeeVariant(),
    supabase.rpc("is_manager"),
    getAdminVariantId(),
    getUnreadNotificationCount(),
  ]);

  // Theme override: only variant colors that are actually set replace the
  // app/globals.css defaults — a variant with no colors configured yet (or a
  // future variant missing one field) falls straight back to the existing
  // Akij Resource palette via normal CSS cascade, never a blank/broken value.
  const themeVars: React.CSSProperties = {
    ...(variant.primaryColor ? { "--green": variant.primaryColor } : {}),
    ...(variant.secondaryColor ? { "--green-dark": variant.secondaryColor } : {}),
    ...(variant.accentColor ? { "--blue": variant.accentColor } : {}),
    ...(variant.backgroundColor ? { "--bg": variant.backgroundColor } : {}),
  } as React.CSSProperties;

  return (
    <div className="flex min-h-full flex-col" style={themeVars}>
      <div className="fixed right-4 top-4 z-30">
        <NotificationBell unreadCount={unreadNotificationCount} />
      </div>
      <div className="flex-1 px-4 pb-28 pt-1">{children}</div>
      <PushPrompt publicKey={process.env.VAPID_PUBLIC_KEY ?? null} />
      <BottomNav
        showTeamTab={Boolean(isManagerData)}
        navMode={variant.navMode}
        showEmployeesTab={Boolean(adminVariantId)}
      />
    </div>
  );
}
