import { pushToEnrolls } from "@/lib/push";
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { isTestEmployee } from "@/lib/test-employees";

export interface LeaderboardEntry {
  enrollNumber: string;
  name: string;
  designation: string | null;
  sbu: string | null;
  score: number;
  lastSubmittedAt: string;
  rank: number;
  photoUrl: string | null;
}

// Combined score across every journey the employee has submitted in this
// variant, ranked desc; ties broken by whoever finished their most recent
// submission earliest (per spec: "completed their assessment earliest").
export async function getLeaderboard(variantId: string): Promise<LeaderboardEntry[]> {
  const admin = createAdminClient();
  const { data: submissions } = await admin
    .from("journey_assessment_submissions")
    .select("employee_enroll_number, score, submitted_at")
    .eq("variant_id", variantId);
  if (!submissions || submissions.length === 0) return [];

  // HR admins never appear on the leaderboard even if they take the
  // assessment — this is an employee ranking, not an admin one.
  const submitterEnrolls = [...new Set(submissions.map((s) => s.employee_enroll_number))];
  const { data: submitterProfiles } = await admin
    .from("profiles")
    .select("enroll_number, is_hr_admin")
    .in("enroll_number", submitterEnrolls);
  const hrAdminEnrolls = new Set((submitterProfiles ?? []).filter((p) => p.is_hr_admin).map((p) => p.enroll_number));

  const byEmployee = new Map<string, { score: number; lastSubmittedAt: string }>();
  for (const s of submissions) {
    if (isTestEmployee(s.employee_enroll_number) || hrAdminEnrolls.has(s.employee_enroll_number)) continue;
    const existing = byEmployee.get(s.employee_enroll_number);
    if (!existing) {
      byEmployee.set(s.employee_enroll_number, { score: s.score, lastSubmittedAt: s.submitted_at });
    } else {
      existing.score += s.score;
      if (s.submitted_at > existing.lastSubmittedAt) existing.lastSubmittedAt = s.submitted_at;
    }
  }

  const enrollNumbers = [...byEmployee.keys()];
  const [{ data: employees }, { data: photos }] = await Promise.all([
    admin.from("employees").select("enroll_number, name, designation, sbu").in("enroll_number", enrollNumbers),
    admin.from("leaderboard_photos").select("employee_enroll_number, storage_path").in("employee_enroll_number", enrollNumbers),
  ]);
  const employeeByEnroll = new Map((employees ?? []).map((e) => [e.enroll_number, e]));
  const photoByEnroll = new Map((photos ?? []).map((p) => [p.employee_enroll_number, p.storage_path]));

  const entries: LeaderboardEntry[] = enrollNumbers.map((enrollNumber) => {
    const agg = byEmployee.get(enrollNumber)!;
    const emp = employeeByEnroll.get(enrollNumber);
    const path = photoByEnroll.get(enrollNumber);
    return {
      enrollNumber,
      name: emp?.name ?? enrollNumber,
      designation: emp?.designation ?? null,
      sbu: emp?.sbu ?? null,
      score: agg.score,
      lastSubmittedAt: agg.lastSubmittedAt,
      rank: 0,
      photoUrl: path ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/leaderboard-photos/${path}` : null,
    };
  });

  entries.sort((a, b) => b.score - a.score || (a.lastSubmittedAt < b.lastSubmittedAt ? -1 : a.lastSubmittedAt > b.lastSubmittedAt ? 1 : 0));
  entries.forEach((e, i) => (e.rank = i + 1));
  return entries;
}

// Called after every assessment submission — ranks shift, so anyone no
// longer in the top 3 loses their podium photo outright (storage object +
// row), and anyone newly in the top 3 without a photo yet gets a one-time
// notification inviting them to upload one.
export async function syncLeaderboardAfterSubmission(variantId: string): Promise<LeaderboardEntry[]> {
  const entries = await getLeaderboard(variantId);
  const top3 = new Set(entries.filter((e) => e.rank <= 3).map((e) => e.enrollNumber));
  const admin = createAdminClient();

  const { data: photos } = await admin
    .from("leaderboard_photos")
    .select("employee_enroll_number, storage_path")
    .eq("variant_id", variantId);
  for (const photo of photos ?? []) {
    if (!top3.has(photo.employee_enroll_number)) {
      await admin.storage.from("leaderboard-photos").remove([photo.storage_path]);
      await admin.from("leaderboard_photos").delete().eq("employee_enroll_number", photo.employee_enroll_number);
    }
  }

  const photoedEnrolls = new Set((photos ?? []).map((p) => p.employee_enroll_number));
  for (const entry of entries.filter((e) => e.rank <= 3)) {
    if (photoedEnrolls.has(entry.enrollNumber)) continue;
    const { data: existingNotif } = await admin
      .from("notifications")
      .select("id")
      .eq("recipient_enroll_number", entry.enrollNumber)
      .eq("action_url", "/leaderboard/upload-photo")
      .eq("is_read", false)
      .maybeSingle();
    if (existingNotif) continue;
    await admin.from("notifications").insert({
      variant_id: variantId,
      recipient_enroll_number: entry.enrollNumber,
      title: "আপনি লিডারবোর্ডে টপ ৩-এ জায়গা পেয়েছেন!",
      body: "অভিনন্দন! পডিয়ামের জন্য আপনার একটি ছবি আপলোড করুন।",
      action_url: "/leaderboard/upload-photo",
    });
    await pushToEnrolls([entry.enrollNumber], {
      title: "আপনি লিডারবোর্ডে টপ ৩-এ জায়গা পেয়েছেন!",
      body: "অভিনন্দন! পডিয়ামের জন্য আপনার একটি ছবি আপলোড করুন।",
      url: "/leaderboard/upload-photo",
    });
  }

  return entries;
}
