"use server";

import { pushToEnrolls } from "@/lib/push";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { currentPeriodMonth, periodLabel } from "@/lib/employee-kpi";

interface ActionResult {
  error?: string;
  success?: boolean;
}

type KpiFrequency = "daily" | "weekly" | "monthly";

interface KpiItemInput {
  name: string;
  target: number;
  unit: string;
  frequency: KpiFrequency;
}

async function currentEnrollNumber(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("enroll_number").eq("id", user.id).single();
  return profile?.enroll_number ?? null;
}

/**
 * Manager-only actions (add/remove KPI, approve/reject) must be blocked for
 * the employee themselves — the kpi_submissions/kpi_items UPDATE RLS
 * policies also allow `employee_enroll_number = current_enroll_number()`
 * (so an employee can edit their own pending submission), which would
 * otherwise let someone navigate straight to their own review URL and
 * self-approve. RLS alone doesn't distinguish "editing my own submission"
 * from "approving it as its manager", so that check has to happen here.
 */
async function assertIsManagerOf(employeeEnrollNumber: string, callerEnrollNumber: string): Promise<boolean> {
  if (callerEnrollNumber === employeeEnrollNumber) return false;
  const supabase = await createClient();
  const [{ data: isManagerOf }, { data: isHrAdmin }] = await Promise.all([
    supabase.rpc("is_manager_of", { target_enroll: employeeEnrollNumber }),
    supabase.rpc("is_hr_admin"),
  ]);
  return Boolean(isManagerOf) || Boolean(isHrAdmin);
}

/** True only for the SA0001 master-administrator test/override account —
 * distinct from assertIsManagerOf, which also passes for real managers.
 * Anything gated on this alone (unlocking an approved submission, deleting
 * an employee-authored KPI item) must stay exclusive to that one account. */
async function isSuperAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: profile } = await supabase.from("profiles").select("is_super_admin").eq("id", user.id).single();
  return Boolean(profile?.is_super_admin);
}

/** Resolves an employee's reporting manager's own enroll number, via the
 * admin client — a subordinate can't SELECT their manager's employees row
 * under normal RLS (they're not that row's manager), so this lookup (used
 * only to address a notification) needs the same elevated path notifications
 * themselves require. */
async function findManagerEnrollNumber(employeeEnrollNumber: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data: employee } = await admin
    .from("employees")
    .select("reporting_manager_email")
    .eq("enroll_number", employeeEnrollNumber)
    .single();
  if (!employee?.reporting_manager_email) return null;

  const { data: manager } = await admin
    .from("employees")
    .select("enroll_number")
    .ilike("email", employee.reporting_manager_email)
    .maybeSingle();
  return manager?.enroll_number ?? null;
}

async function notify(
  recipientEnrollNumber: string,
  type: "submission" | "approval" | "rejection" | "manager_added_kpi" | "achievement_update" | "not_submitted_reminder",
  title: string,
  body: string,
  relatedSubmissionId: string,
): Promise<void> {
  const admin = createAdminClient();
  await admin.from("kpi_notifications").insert({
    recipient_enroll_number: recipientEnrollNumber,
    type,
    title,
    body,
    related_submission_id: relatedSubmissionId,
  });
  await pushToEnrolls([recipientEnrollNumber], { title, body, url: "/employee-kpi/notifications" });
}

/** Employee submits (or resubmits, after rejection) this month's KPI set.
 * Replaces only the employee-authored items — anything the manager already
 * added stays, since that's part of the same set being reviewed. */
export async function submitMonthlyKpis(input: { items: KpiItemInput[]; employeeNote: string }): Promise<ActionResult> {
  const enrollNumber = await currentEnrollNumber();
  if (!enrollNumber) return { error: "লগইন করা নেই।" };
  if (input.items.length === 0) return { error: "অন্তত একটি KPI যোগ করুন।" };
  for (const item of input.items) {
    if (!item.name.trim()) return { error: "প্রতিটি KPI-এর নাম দিন।" };
    if (!(item.target > 0)) return { error: "Target অবশ্যই ০-এর বেশি হতে হবে।" };
  }

  const supabase = await createClient();
  const period = currentPeriodMonth();

  const { data: existing } = await supabase
    .from("kpi_submissions")
    .select("id, status")
    .eq("employee_enroll_number", enrollNumber)
    .eq("period_month", period)
    .maybeSingle();

  if (existing && existing.status === "approved") {
    return { error: "এই মাসের KPI ইতিমধ্যে approved — নতুন করে submit করা যাবে না।" };
  }

  let submissionId = existing?.id;
  if (submissionId) {
    const { error } = await supabase
      .from("kpi_submissions")
      .update({ status: "pending", employee_note: input.employeeNote.trim() || null, submitted_at: new Date().toISOString() })
      .eq("id", submissionId);
    if (error) return { error: "Submit করা যায়নি। একটু পর আবার চেষ্টা করুন।" };
    await supabase.from("kpi_items").delete().eq("submission_id", submissionId).eq("added_by_manager", false);
  } else {
    const { data: created, error } = await supabase
      .from("kpi_submissions")
      .insert({ employee_enroll_number: enrollNumber, period_month: period, employee_note: input.employeeNote.trim() || null })
      .select("id")
      .single();
    if (error || !created) return { error: "Submit করা যায়নি। একটু পর আবার চেষ্টা করুন।" };
    submissionId = created.id;
  }

  const { error: itemsError } = await supabase.from("kpi_items").insert(
    input.items.map((item) => ({
      submission_id: submissionId,
      employee_enroll_number: enrollNumber,
      name: item.name.trim(),
      target: item.target,
      unit: item.unit.trim() || null,
      frequency: item.frequency,
    })),
  );
  if (itemsError) return { error: "Submit করা যায়নি। একটু পর আবার চেষ্টা করুন।" };

  // The manager notification isn't needed for the response the employee is
  // waiting on — deferred via after() so it runs post-response instead of
  // adding 2+ extra round trips (manager lookup + notification insert) to
  // the perceived latency of the Submit button.
  after(async () => {
    const managerEnrollNumber = await findManagerEnrollNumber(enrollNumber);
    if (managerEnrollNumber) {
      await notify(
        managerEnrollNumber,
        "submission",
        "নতুন KPI submission",
        `${enrollNumber} ${periodLabel(period)}-এর KPI submit করেছেন।`,
        submissionId,
      );
    }
  });

  revalidatePath("/kpi");
  revalidatePath("/employee-kpi");
  return { success: true };
}

/** Employee updates their current achievement on one KPI item — the only
 * field editable after approval locks the target/name. */
export async function updateAchievement(input: { itemId: string; achievement: number; comment: string }): Promise<ActionResult> {
  const enrollNumber = await currentEnrollNumber();
  if (!enrollNumber) return { error: "লগইন করা নেই।" };
  if (input.achievement < 0) return { error: "Achievement ঋণাত্মক হতে পারে না।" };

  const supabase = await createClient();
  // Single query embedding the parent submission's status — was two
  // sequential round trips (item, then its submission) for a check that
  // only needs one column from each.
  const { data: item } = await supabase
    .from("kpi_items")
    .select("id, submission_id, name, employee_enroll_number, kpi_submissions(status)")
    .eq("id", input.itemId)
    .single();
  if (!item || item.employee_enroll_number !== enrollNumber) return { error: "KPI item পাওয়া যায়নি।" };
  if (item.kpi_submissions?.status !== "approved") return { error: "শুধু approved KPI-এর achievement update করা যায়।" };

  const { error } = await supabase
    .from("kpi_items")
    .update({ achievement: input.achievement, achievement_updated_at: new Date().toISOString() })
    .eq("id", input.itemId);
  if (error) return { error: "Update করা যায়নি। একটু পর আবার চেষ্টা করুন।" };

  if (input.comment.trim()) {
    await supabase.from("kpi_comments").insert({
      submission_id: item.submission_id,
      employee_enroll_number: enrollNumber,
      author_enroll_number: enrollNumber,
      author_role: "employee",
      comment: input.comment.trim(),
    });
  }

  // Deferred for the same reason as submitMonthlyKpis — not needed for the
  // response, shouldn't add latency to the Save Update button.
  after(async () => {
    const managerEnrollNumber = await findManagerEnrollNumber(enrollNumber);
    if (managerEnrollNumber) {
      await notify(
        managerEnrollNumber,
        "achievement_update",
        "Achievement আপডেট হয়েছে",
        `${enrollNumber} '${item.name}' KPI-এর achievement আপডেট করেছেন।`,
        item.submission_id,
      );
    }
  });

  revalidatePath("/kpi");
  revalidatePath("/employee-kpi");
  return { success: true };
}

/** Manager adds an extra KPI to a subordinate's submission — review-only:
 * blocked once the set is approved and locked. */
export async function addManagerKpi(input: {
  submissionId: string;
  employeeEnrollNumber: string;
  name: string;
  target: number;
  unit: string;
}): Promise<ActionResult> {
  const managerEnrollNumber = await currentEnrollNumber();
  if (!managerEnrollNumber) return { error: "লগইন করা নেই।" };
  if (!(await assertIsManagerOf(input.employeeEnrollNumber, managerEnrollNumber))) {
    return { error: "এই কাজের অনুমতি নেই।" };
  }
  if (!input.name.trim()) return { error: "KPI-এর নাম দিন।" };
  if (!(input.target > 0)) return { error: "Target অবশ্যই ০-এর বেশি হতে হবে।" };

  const supabase = await createClient();
  const { data: submission } = await supabase.from("kpi_submissions").select("status").eq("id", input.submissionId).single();
  if (!submission) return { error: "Submission পাওয়া যায়নি।" };
  if (submission.status !== "pending" && !(await isSuperAdmin())) {
    return { error: "শুধু pending submission-এ নতুন KPI যোগ করা যায়।" };
  }

  const { error } = await supabase.from("kpi_items").insert({
    submission_id: input.submissionId,
    employee_enroll_number: input.employeeEnrollNumber,
    name: input.name.trim(),
    target: input.target,
    unit: input.unit.trim() || null,
    added_by_manager: true,
  });
  if (error) return { error: "যোগ করা যায়নি। একটু পর আবার চেষ্টা করুন।" };

  after(() =>
    notify(
      input.employeeEnrollNumber,
      "manager_added_kpi",
      "নতুন KPI যোগ হয়েছে",
      `আপনার manager '${input.name}' KPI যোগ করেছেন।`,
      input.submissionId,
    ),
  );

  revalidatePath(`/team/${input.employeeEnrollNumber}`);
  revalidatePath(`/employee-kpi/review/${input.employeeEnrollNumber}`);
  return { success: true };
}

/** Manager removes a KPI they added themselves — review-only, and only for
 * items they added (never an employee's own item). */
export async function removeManagerKpi(input: { itemId: string; employeeEnrollNumber: string }): Promise<ActionResult> {
  const managerEnrollNumber = await currentEnrollNumber();
  if (!managerEnrollNumber) return { error: "লগইন করা নেই।" };
  if (!(await assertIsManagerOf(input.employeeEnrollNumber, managerEnrollNumber))) {
    return { error: "এই কাজের অনুমতি নেই।" };
  }

  const supabase = await createClient();
  const superAdmin = await isSuperAdmin();
  const { data: item } = await supabase
    .from("kpi_items")
    .select("id, submission_id, added_by_manager")
    .eq("id", input.itemId)
    .single();
  if (!item || (!item.added_by_manager && !superAdmin)) return { error: "শুধু আপনার যোগ করা KPI মুছে ফেলা যায়।" };

  const { data: submission } = await supabase.from("kpi_submissions").select("status").eq("id", item.submission_id).single();
  if (submission?.status !== "pending" && !superAdmin) return { error: "শুধু pending submission থেকে KPI মুছে ফেলা যায়।" };

  const { error } = await supabase.from("kpi_items").delete().eq("id", input.itemId);
  if (error) return { error: "মুছে ফেলা যায়নি। একটু পর আবার চেষ্টা করুন।" };

  revalidatePath(`/team/${input.employeeEnrollNumber}`);
  revalidatePath(`/employee-kpi/review/${input.employeeEnrollNumber}`);
  return { success: true };
}

async function reviewSubmission(
  submissionId: string,
  employeeEnrollNumber: string,
  status: "approved" | "rejected",
  comment: string,
): Promise<ActionResult> {
  const managerEnrollNumber = await currentEnrollNumber();
  if (!managerEnrollNumber) return { error: "লগইন করা নেই।" };
  if (!(await assertIsManagerOf(employeeEnrollNumber, managerEnrollNumber))) {
    return { error: "এই কাজের অনুমতি নেই।" };
  }
  if (status === "rejected" && !comment.trim()) return { error: "Reject করার কারণ লিখুন।" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("kpi_submissions")
    .update({
      status,
      manager_comment: comment.trim() || null,
      reviewed_at: new Date().toISOString(),
      reviewed_by_enroll_number: managerEnrollNumber,
    })
    .eq("id", submissionId);
  if (error) return { error: "সংরক্ষণ করা যায়নি। একটু পর আবার চেষ্টা করুন।" };

  if (comment.trim()) {
    await supabase.from("kpi_comments").insert({
      submission_id: submissionId,
      employee_enroll_number: employeeEnrollNumber,
      author_enroll_number: managerEnrollNumber,
      author_role: "manager",
      comment: comment.trim(),
    });
  }

  after(() =>
    notify(
      employeeEnrollNumber,
      status === "approved" ? "approval" : "rejection",
      status === "approved" ? "KPI Approved" : "KPI Rejected",
      status === "approved" ? "আপনার KPI approve হয়েছে — এখন Actual KPI হিসেবে লক করা হয়েছে।" : `আপনার KPI reject হয়েছে। ${comment.trim()}`,
      submissionId,
    ),
  );

  revalidatePath(`/team/${employeeEnrollNumber}`);
  revalidatePath("/kpi");
  return { success: true };
}

export async function approveSubmission(input: { submissionId: string; employeeEnrollNumber: string; comment: string }): Promise<ActionResult> {
  return reviewSubmission(input.submissionId, input.employeeEnrollNumber, "approved", input.comment);
}

export async function rejectSubmission(input: { submissionId: string; employeeEnrollNumber: string; comment: string }): Promise<ActionResult> {
  return reviewSubmission(input.submissionId, input.employeeEnrollNumber, "rejected", input.comment);
}

/** Master-administrator-only: reverts an approved or rejected submission back
 * to pending so it re-enters the review wizard (add/remove KPI, re-approve) —
 * the only way to edit a KPI set once it's locked. Exclusive to SA0001. */
export async function adminUnlockSubmission(submissionId: string, employeeEnrollNumber: string): Promise<ActionResult> {
  if (!(await isSuperAdmin())) return { error: "এই কাজের অনুমতি নেই।" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("kpi_submissions")
    .update({ status: "pending", reviewed_at: null, reviewed_by_enroll_number: null })
    .eq("id", submissionId);
  if (error) return { error: "Unlock করা যায়নি। একটু পর আবার চেষ্টা করুন।" };

  revalidatePath(`/team/${employeeEnrollNumber}`);
  revalidatePath(`/employee-kpi/review/${employeeEnrollNumber}`);
  return { success: true };
}

export async function markNotificationRead(notificationId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("kpi_notifications").update({ is_read: true }).eq("id", notificationId);
  if (error) return { error: "Update করা যায়নি।" };
  revalidatePath("/employee-kpi/notifications");
  return { success: true };
}

export async function markAllNotificationsRead(): Promise<ActionResult> {
  const enrollNumber = await currentEnrollNumber();
  if (!enrollNumber) return { error: "লগইন করা নেই।" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("kpi_notifications")
    .update({ is_read: true })
    .eq("recipient_enroll_number", enrollNumber)
    .eq("is_read", false);
  if (error) return { error: "Update করা যায়নি।" };
  revalidatePath("/employee-kpi/notifications");
  return { success: true };
}
