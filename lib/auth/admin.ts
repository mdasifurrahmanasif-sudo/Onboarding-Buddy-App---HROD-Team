import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeSbuName } from "@/lib/sbu-matching";

export type AdminRole = "super_admin" | "journey_admin" | "hrbp";
export type AdminAccess = { role: AdminRole; enrollNumber: string; variantId: string | null; sbus: string[] };

/** Who the signed-in user is on the admin site, or null for non-admins.
 * Super/journey admin come from the profile flags (what the rest of the app
 * already reads); HRBP only exists in admin_grants. */
export const getAdminAccess = cache(async (): Promise<AdminAccess | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("enroll_number, is_super_admin, is_hr_admin, admin_variant_id")
    .eq("id", user.id)
    .single();
  if (!profile) return null;

  const base = { enrollNumber: profile.enroll_number, variantId: profile.admin_variant_id, sbus: [] };
  if (profile.is_super_admin) return { ...base, role: "super_admin" };
  if (profile.is_hr_admin && profile.admin_variant_id) return { ...base, role: "journey_admin" };

  const { data: grant } = await createAdminClient()
    .from("admin_grants")
    .select("sbus")
    .eq("enroll_number", profile.enroll_number)
    .eq("role", "hrbp")
    .maybeSingle();
  return grant ? { ...base, variantId: null, role: "hrbp", sbus: grant.sbus } : null;
});

/** Whether this admin may see an employee. Journey admins see their journey's
 * people, HRBPs the people in their SBUs, super admins everyone. */
export function canSeeEmployee(access: AdminAccess, employee: { sbu: string | null }, employeeVariantId: string): boolean {
  if (access.role === "super_admin") return true;
  if (access.role === "journey_admin") return employeeVariantId === access.variantId;
  const sbu = employee.sbu ? normalizeSbuName(employee.sbu) : null;
  return sbu !== null && access.sbus.some((s) => normalizeSbuName(s) === sbu);
}

/**
 * Every admin-tasks/admin-resources action re-derives this from the session
 * server-side rather than trusting a client-sent variant id — an HR admin's
 * admin_variant_id is the only variant they're ever allowed to write to.
 */
export async function requireVariantAdmin(): Promise<{ variantId: string } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_hr_admin, admin_variant_id")
    .eq("id", user.id)
    .single();

  if (!profile?.is_hr_admin || !profile.admin_variant_id) return { error: "Not authorized." };
  return { variantId: profile.admin_variant_id };
}

/** Gate for the cross-module broadcast composer — unlike requireVariantAdmin,
 * a super admin isn't scoped to one variant and can target any of them. */
export async function requireSuperAdmin(): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { data: profile } = await supabase.from("profiles").select("is_super_admin").eq("id", user.id).single();
  if (!profile?.is_super_admin) return { error: "Not authorized." };
  return { ok: true };
}
