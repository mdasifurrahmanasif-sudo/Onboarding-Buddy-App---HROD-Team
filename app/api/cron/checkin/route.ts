import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { mapOnboardingVariant, resolveVariantForSbu } from "@/lib/onboarding-variant";
import { isCheckinDay, ratingJoiningDate, ratingWindow } from "@/lib/day-ratings";
import { pushToEnrolls } from "@/lib/push";
import { isTestEmployee } from "@/lib/test-employees";

const TITLE = "Hey, just checking on you 👋";
const BODY = "Are you doing fine? Tap to tell us how it's going. It's anonymous.";

/**
 * Called daily at 10 am Dhaka by Supabase pg_cron (job "checkin-10am").
 * New joiners (same rules as day ratings) who are on Day 15, 30, 45 or 60
 * today and haven't answered get a bell notification + phone push.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const [{ data: profiles }, { data: employees }, { data: variantsData }, { data: answered }] = await Promise.all([
    admin.from("profiles").select("enroll_number, created_at").limit(10000),
    admin.from("employees").select("enroll_number, sbu, joining_date").limit(10000),
    admin.from("onboarding_variants").select("*"),
    admin.from("checkins").select("enroll_number, day_number").limit(50000),
  ]);
  const variants = (variantsData ?? []).map(mapOnboardingVariant);
  const emp = new Map((employees ?? []).map((e) => [e.enroll_number, e]));
  const done = new Set((answered ?? []).map((a) => `${a.enroll_number}:${a.day_number}`));

  const recipients = (profiles ?? [])
    .filter((p) => !isTestEmployee(p.enroll_number))
    .map((p) => ({
      enroll: p.enroll_number,
      w: ratingWindow(ratingJoiningDate(p.enroll_number, emp.get(p.enroll_number)?.joining_date ?? null), p.created_at),
    }))
    .filter((r) => r.w && isCheckinDay(r.w) && !done.has(`${r.enroll}:${r.w.today}`));

  if (req.nextUrl.searchParams.get("dryRun") === "1") {
    return NextResponse.json({ dryRun: true, wouldNotify: recipients.length, days: [...new Set(recipients.map((r) => r.w!.today))] });
  }

  const rows = recipients.map((r) => ({
    variant_id: resolveVariantForSbu(emp.get(r.enroll)?.sbu, variants).id,
    recipient_enroll_number: r.enroll,
    title: TITLE,
    body: BODY,
    action_url: "/home",
  }));
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await admin.from("notifications").insert(rows.slice(i, i + 500));
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  await pushToEnrolls(
    recipients.map((r) => r.enroll),
    { title: TITLE, body: BODY, url: "/home", ttlSeconds: 12 * 60 * 60 },
  );

  return NextResponse.json({ notified: recipients.length });
}
