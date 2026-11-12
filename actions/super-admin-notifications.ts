"use server";

import { pushToEnrolls } from "@/lib/push";
import { requireSuperAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOnboardingVariants } from "@/lib/data/queries";
import { mapOnboardingVariant, resolveVariantForSbu } from "@/lib/onboarding-variant";

interface ActionResult {
  error?: string;
  success?: boolean;
}

export interface EmployeePreview {
  enrollNumber: string;
  name: string;
  designation: string | null;
  department: string | null;
}

async function resolveVariantId(variantId: string) {
  const { data: variantsData } = await getOnboardingVariants();
  const variants = (variantsData ?? []).map(mapOnboardingVariant);
  const variant = variants.find((v) => v.id === variantId);
  return { variant, variants };
}

export async function previewEmployeeForBroadcast(
  enrollNumber: string,
  variantId: string,
): Promise<{ employee?: EmployeePreview; error?: string }> {
  const auth = await requireSuperAdmin();
  if ("error" in auth) return { error: auth.error };
  if (!enrollNumber.trim()) return { error: "Enroll number দিন।" };

  const admin = createAdminClient();
  const { data: employee } = await admin
    .from("employees")
    .select("enroll_number, name, sbu, designation, department")
    .eq("enroll_number", enrollNumber.trim())
    .single();
  if (!employee) return { error: "Employee পাওয়া যায়নি।" };

  const { variant, variants } = await resolveVariantId(variantId);
  if (!variant) return { error: "Invalid variant." };
  if (resolveVariantForSbu(employee.sbu, variants).id !== variant.id) {
    return { error: "এই employee এই variant-এর না।" };
  }

  return {
    employee: {
      enrollNumber: employee.enroll_number,
      name: employee.name,
      designation: employee.designation,
      department: employee.department,
    },
  };
}

export async function sendBroadcastToEmployee(enrollNumber: string, variantId: string, formData: FormData): Promise<ActionResult> {
  const auth = await requireSuperAdmin();
  if ("error" in auth) return { error: auth.error };

  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { error: "Message লিখুন।" };

  // Re-verified server-side, not trusted from whatever the preview step
  // showed the client — a stale/tampered preview shouldn't be able to send.
  const preview = await previewEmployeeForBroadcast(enrollNumber, variantId);
  if (!preview.employee) return { error: preview.error ?? "Not authorized." };

  const admin = createAdminClient();
  const { error } = await admin.from("notifications").insert({
    variant_id: variantId,
    recipient_enroll_number: enrollNumber,
    title: title || "Notification",
    body,
  });
  if (error) return { error: error.message };
  await pushToEnrolls([enrollNumber], { title: title || "Notification", body });
  return { success: true };
}

export async function sendBroadcastToAll(variantId: string, formData: FormData): Promise<ActionResult> {
  const auth = await requireSuperAdmin();
  if ("error" in auth) return { error: auth.error };

  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { error: "Message লিখুন।" };

  const { variant, variants } = await resolveVariantId(variantId);
  if (!variant) return { error: "Invalid variant." };

  const admin = createAdminClient();
  const { data: allEmployees } = await admin.from("employees").select("enroll_number, sbu");
  const recipients = (allEmployees ?? []).filter((e) => resolveVariantForSbu(e.sbu, variants).id === variant.id);
  if (recipients.length === 0) return { error: "এই variant-এ কোনো employee নেই।" };

  const { error } = await admin.from("notifications").insert(
    recipients.map((e) => ({
      variant_id: variant.id,
      recipient_enroll_number: e.enroll_number,
      title: title || "Notification",
      body,
    })),
  );
  if (error) return { error: error.message };
  await pushToEnrolls(recipients.map((e) => e.enroll_number), { title: title || "Notification", body });
  return { success: true };
}
