"use server";

import { pushToEnrolls } from "@/lib/push";
import { requireVariantAdmin } from "@/lib/auth/admin";
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

export async function previewEmployeeForNotification(
  enrollNumber: string,
): Promise<{ employee?: EmployeePreview; error?: string }> {
  const auth = await requireVariantAdmin();
  if ("error" in auth) return { error: auth.error };
  if (!enrollNumber.trim()) return { error: "Enroll number দিন।" };

  const admin = createAdminClient();
  const { data: employee } = await admin
    .from("employees")
    .select("enroll_number, name, sbu, designation, department")
    .eq("enroll_number", enrollNumber.trim())
    .single();
  if (!employee) return { error: "Employee পাওয়া যায়নি।" };

  const { data: variantsData } = await getOnboardingVariants();
  const variant = resolveVariantForSbu(employee.sbu, (variantsData ?? []).map(mapOnboardingVariant));
  if (variant.id !== auth.variantId) return { error: "এই employee আপনার variant-এর না।" };

  return {
    employee: {
      enrollNumber: employee.enroll_number,
      name: employee.name,
      designation: employee.designation,
      department: employee.department,
    },
  };
}

export async function sendNotificationToEmployee(enrollNumber: string, formData: FormData): Promise<ActionResult> {
  const auth = await requireVariantAdmin();
  if ("error" in auth) return { error: auth.error };

  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { error: "Message লিখুন।" };

  // Re-verified server-side, not trusted from whatever the preview step
  // showed the client — a stale/tampered preview shouldn't be able to send.
  const preview = await previewEmployeeForNotification(enrollNumber);
  if (!preview.employee) return { error: preview.error ?? "Not authorized." };

  const admin = createAdminClient();
  const { error } = await admin.from("notifications").insert({
    variant_id: auth.variantId,
    recipient_enroll_number: enrollNumber,
    title: title || "Notification",
    body,
  });
  if (error) return { error: error.message };
  await pushToEnrolls([enrollNumber], { title: title || "Notification", body });
  return { success: true };
}

export async function sendNotificationToAll(formData: FormData): Promise<ActionResult> {
  const auth = await requireVariantAdmin();
  if ("error" in auth) return { error: auth.error };

  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { error: "Message লিখুন।" };

  const admin = createAdminClient();
  const [{ data: allEmployees }, { data: variantsData }] = await Promise.all([
    admin.from("employees").select("enroll_number, sbu"),
    getOnboardingVariants(),
  ]);
  const variants = (variantsData ?? []).map(mapOnboardingVariant);
  const recipients = (allEmployees ?? []).filter((e) => resolveVariantForSbu(e.sbu, variants).id === auth.variantId);
  if (recipients.length === 0) return { error: "এই variant-এ কোনো employee নেই।" };

  const { error } = await admin.from("notifications").insert(
    recipients.map((e) => ({
      variant_id: auth.variantId,
      recipient_enroll_number: e.enroll_number,
      title: title || "Notification",
      body,
    })),
  );
  if (error) return { error: error.message };
  await pushToEnrolls(recipients.map((e) => e.enroll_number), { title: title || "Notification", body });
  return { success: true };
}
