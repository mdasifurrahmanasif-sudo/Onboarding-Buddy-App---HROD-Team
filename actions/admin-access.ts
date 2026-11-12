"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminAccess, type AdminRole } from "@/lib/auth/admin";

const ROLES: AdminRole[] = ["super_admin", "journey_admin", "hrbp"];

function back(error?: string): never {
  redirect(error ? `/admin/admins?error=${encodeURIComponent(error)}` : "/admin/admins");
}

/** Super admins aren't tied to one journey: this picks which journey the
 * existing content pages (tasks, resources, ...) edit. */
export async function setWorkingJourney(formData: FormData) {
  const access = await getAdminAccess();
  if (access?.role !== "super_admin") redirect("/home");

  const variantId = String(formData.get("variantId") ?? "");
  const admin = createAdminClient();
  const { data: variant } = await admin.from("onboarding_variants").select("id").eq("id", variantId).maybeSingle();
  if (variant) {
    await admin.from("profiles").update({ admin_variant_id: variant.id }).eq("enroll_number", access.enrollNumber);
  }
  revalidatePath("/admin", "layout");
}

/** Creates or changes someone's admin role. Works before they sign up: the
 * profiles trigger applies the grant when their account is created. */
export async function saveAdminGrant(formData: FormData) {
  const access = await getAdminAccess();
  if (access?.role !== "super_admin") redirect("/home");

  const enrollNumber = String(formData.get("enrollNumber") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "") as AdminRole;
  const variantId = String(formData.get("variantId") ?? "") || null;
  const sbus = formData.getAll("sbus").map(String).filter(Boolean);

  if (!enrollNumber) back("Enter an enroll number.");
  if (!ROLES.includes(role)) back("Pick a role.");
  if (role === "journey_admin" && !variantId) back("A journey admin needs a journey.");
  if (role === "hrbp" && sbus.length === 0) back("An HRBP needs at least one SBU.");
  if (enrollNumber === access.enrollNumber && role !== "super_admin") back("You can't remove your own super admin role.");

  const admin = createAdminClient();
  const { error } = await admin.from("admin_grants").upsert({
    enroll_number: enrollNumber,
    role,
    variant_id: role === "hrbp" ? null : variantId,
    sbus: role === "hrbp" ? sbus : [],
    granted_by: access.enrollNumber,
    updated_at: new Date().toISOString(),
  });
  if (error) back("Couldn't save the role. Try again.");

  // Already signed up: apply now. (Not signed up yet: the trigger does it.)
  const profileUpdate =
    role === "hrbp"
      ? { is_super_admin: false, is_hr_admin: false, admin_variant_id: null }
      : {
          is_super_admin: role === "super_admin",
          is_hr_admin: true,
          ...(variantId ? { admin_variant_id: variantId } : {}),
        };
  await admin.from("profiles").update(profileUpdate).eq("enroll_number", enrollNumber);

  revalidatePath("/admin/admins");
  back();
}

export async function removeAdminGrant(formData: FormData) {
  const access = await getAdminAccess();
  if (access?.role !== "super_admin") redirect("/home");

  const enrollNumber = String(formData.get("enrollNumber") ?? "");
  if (enrollNumber === access.enrollNumber) back("You can't remove yourself.");

  const admin = createAdminClient();
  await admin.from("admin_grants").delete().eq("enroll_number", enrollNumber);
  await admin
    .from("profiles")
    .update({ is_super_admin: false, is_hr_admin: false, admin_variant_id: null })
    .eq("enroll_number", enrollNumber);

  revalidatePath("/admin/admins");
  back();
}
