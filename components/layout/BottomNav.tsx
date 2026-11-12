"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/icons/Icon";

const BASE_ITEMS: { href: string; label: string; icon: IconName }[] = [
  { href: "/home", label: "Home", icon: "home" },
  { href: "/journey", label: "Journey", icon: "map" },
  { href: "/kpi", label: "KPI", icon: "trending" },
  { href: "/assistant", label: "AI Assistant", icon: "assistantNav" },
  { href: "/profile", label: "Profile", icon: "user" },
];

// Sales Onboarding (navMode === 'resources') only — the same items,
// relabeled in Bangla. Every other variant/track keeps BASE_ITEMS as-is.
const BASE_ITEMS_BN: { href: string; label: string; icon: IconName }[] = [
  { href: "/home", label: "হোম", icon: "home" },
  { href: "/journey", label: "জার্নি", icon: "map" },
  { href: "/kpi", label: "KPI", icon: "trending" },
  { href: "/assistant", label: "AI সহকারী", icon: "assistantNav" },
  { href: "/profile", label: "প্রোফাইল", icon: "user" },
];

interface BottomNavProps {
  showTeamTab?: boolean;
  /** Akij Light Engineering (and any future variant with nav_mode='resources')
   * has no KPI feature at all — its third tab is Resources instead. */
  navMode?: "kpi" | "resources";
  /** A variant-scoped HR admin has no use for the AI Assistant — their
   * fourth tab is the Employees roster instead. */
  showEmployeesTab?: boolean;
}

export function BottomNav({ showTeamTab, navMode = "kpi", showEmployeesTab }: BottomNavProps) {
  const pathname = usePathname();

  // The Assistant screen replaces the bottom nav with its own fixed chat input bar,
  // matching the prototype's chatInput/nav toggle behavior. Employees has no
  // such special-case screen, so it keeps the normal nav.
  if (pathname.startsWith("/assistant") && !showEmployeesTab) return null;

  const isBn = navMode === "resources";

  let baseItems = isBn
    ? BASE_ITEMS_BN.map((item) =>
        item.href === "/kpi" ? { href: "/resources", label: "রিসোর্স", icon: "book" as IconName } : item,
      )
    : BASE_ITEMS;

  if (showEmployeesTab) {
    baseItems = baseItems.map((item) => {
      if (item.href === "/assistant") {
        return { href: "/employees", label: isBn ? "কর্মীরা" : "Employees", icon: "briefcase" as IconName };
      }
      if (item.href === "/resources") {
        return { href: "/admin/tasks", label: isBn ? "HR প্যানেল" : "HR Panel", icon: "lock" as IconName };
      }
      return item;
    });
  }

  const items = showTeamTab
    ? [
        ...baseItems.slice(0, 2),
        { href: "/team", label: isBn ? "টিম" : "Team", icon: "users" as IconName },
        ...baseItems.slice(2),
      ]
    : baseItems;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-line bg-card px-1.5 pb-[calc(8px+env(safe-area-inset-bottom))] pt-2">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-1 flex-col items-center gap-[3px] px-0.5 py-1.5 font-en text-[11px] font-semibold ${
              active ? "text-green-dark" : "text-muted"
            }`}
          >
            <Icon name={item.icon} size={24} strokeWidth={1.9} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
