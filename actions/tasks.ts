"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { pushToEnrolls } from "@/lib/push";
import { PHASE_META, type PhaseKey } from "@/lib/types";

interface MarkTaskDoneResult {
  error?: string;
  success?: boolean;
  phaseComplete?: boolean;
  phaseTitle?: string;
}

interface ActionResult {
  error?: string;
  success?: boolean;
}

export async function markTaskDone(taskId: string): Promise<MarkTaskDoneResult> {
  const supabase = await createClient();

  // These two don't depend on each other — run them concurrently instead of
  // waiting on auth before even checking whether the task exists.
  const [
    {
      data: { user },
    },
    { data: task },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("onboarding_tasks").select("id, phase, variant_id").eq("id", taskId).single(),
  ]);
  if (!user) return { error: "লগইন করা নেই।" };
  if (!task) return { error: "কাজটি খুঁজে পাওয়া যায়নি।" };

  const { data: profile } = await supabase.from("profiles").select("enroll_number").eq("id", user.id).single();
  if (!profile) return { error: "প্রোফাইল পাওয়া যায়নি।" };

  // Upsert, not update-only: an employee reassigned to a different variant
  // (e.g. SBU changed by an admin after they'd already signed up) has no
  // employee_task_status row for that variant's tasks — the normal signup
  // flow is the only thing that ever inserts one. A plain UPDATE against a
  // missing row silently matches zero rows, so the click appeared to work
  // (optimistic UI) but reverted on the next refresh since nothing was ever
  // written. Upserting makes this self-healing regardless of how the row
  // came to be missing. BRU-05: scoped to the caller's own enroll_number —
  // RLS enforces this too, this is a defense-in-depth check against a
  // tampered taskId.
  const { data: existing } = await supabase
    .from("employee_task_status")
    .select("done")
    .eq("employee_enroll_number", profile.enroll_number)
    .eq("task_id", taskId)
    .maybeSingle();
  if (existing?.done) return { success: true, phaseComplete: false };

  const { error } = await supabase.from("employee_task_status").upsert(
    {
      employee_enroll_number: profile.enroll_number,
      task_id: taskId,
      done: true,
      done_date: new Date().toISOString(),
    },
    { onConflict: "employee_enroll_number,task_id" },
  );

  if (error) return { error: "কাজটি সম্পন্ন করা যায়নি। একটু পর আবার চেষ্টা করুন।" };

  // Independent of each other — fetch concurrently and cross-reference in JS
  // instead of waiting on the phase's task IDs before fetching statuses.
  const [{ data: phaseTasks }, { data: allStatuses }] = await Promise.all([
    supabase.from("onboarding_tasks").select("id").eq("phase", task.phase),
    supabase.from("employee_task_status").select("task_id, done").eq("employee_enroll_number", profile.enroll_number),
  ]);
  const phaseTaskIds = new Set((phaseTasks ?? []).map((t) => t.id));
  // A task with no status row at all (e.g. one never touched yet) must
  // count as "not done" — filtering statuses down to only the rows that
  // exist and checking .every() on that filtered set silently ignores
  // missing rows instead of treating them as incomplete, which is what
  // made the very first task marked done look like the whole phase was
  // complete for anyone missing most of their status rows.
  const doneTaskIds = new Set((allStatuses ?? []).filter((s) => s.done).map((s) => s.task_id));
  const phaseComplete = phaseTaskIds.size > 0 && [...phaseTaskIds].every((id) => doneTaskIds.has(id));

  // Sales Onboarding / dynamic-journey variants only — the default variant's
  // fixed 30/60/90 phases don't need an HR ping per journey completion.
  if (phaseComplete) {
    const { data: variant } = await supabase.from("onboarding_variants").select("is_default").eq("id", task.variant_id).single();
    if (variant && !variant.is_default) {
      const admin = createAdminClient();
      await admin.from("hr_journey_completion_notifications").insert({
        variant_id: task.variant_id,
        employee_enroll_number: profile.enroll_number,
        journey_id: task.phase,
      });

      // Phone alert to this journey's admins plus all super admins.
      const [{ data: grants }, { data: emp }, { data: journey }] = await Promise.all([
        admin.from("admin_grants").select("enroll_number, role, variant_id").in("role", ["super_admin", "journey_admin"]),
        admin.from("employees").select("name").eq("enroll_number", profile.enroll_number).maybeSingle(),
        admin.from("onboarding_phases").select("name").eq("id", task.phase).maybeSingle(),
      ]);
      const adminEnrolls = (grants ?? [])
        .filter((g) => g.role === "super_admin" || g.variant_id === task.variant_id)
        .map((g) => g.enroll_number);
      await pushToEnrolls(adminEnrolls, {
        title: "Journey completed ✅",
        body: `${emp?.name ?? profile.enroll_number} (${profile.enroll_number}) completed ${journey?.name ?? "a journey"}.`,
        url: "/admin/completions",
      });
    }
  }

  revalidatePath("/home");
  revalidatePath("/journey");

  return {
    success: true,
    phaseComplete,
    phaseTitle: PHASE_META[task.phase as PhaseKey]?.title,
  };
}

/** Master-administrator-only: toggle any employee's task done/undone state.
 * Gated by the employee_task_status_admin_update RLS policy (is_super_admin
 * only) — regular managers have no write path to a subordinate's tasks, this
 * is exclusively for the SA0001 test/override account. */
export async function adminSetTaskStatus(
  employeeEnrollNumber: string,
  taskId: string,
  done: boolean,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("employee_task_status").upsert(
    {
      employee_enroll_number: employeeEnrollNumber,
      task_id: taskId,
      done,
      done_date: done ? new Date().toISOString() : null,
    },
    { onConflict: "employee_enroll_number,task_id" },
  );
  if (error) return { error: "Update করা যায়নি — admin অনুমতি প্রয়োজন।" };

  revalidatePath(`/team/${employeeEnrollNumber}`);
  revalidatePath("/team");
  return { success: true };
}
