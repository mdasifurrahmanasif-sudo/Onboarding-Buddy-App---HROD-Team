import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { mapOnboardingVariant, resolveVariantForSbu } from "@/lib/onboarding-variant";
import { ratingWindow } from "@/lib/day-ratings";
import { pushToEnrolls } from "@/lib/push";
import { isTestEmployee } from "@/lib/test-employees";

/**
 * Called daily at 5 pm Dhaka by Supabase pg_cron (job "daily-rating-5pm").
 * Sends "rate your day" as a bell notification + phone push to everyone who
 * has opened the app, joined on/after 1 Nov 2026, is within their first 60
 * days, and hasn't rated today.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const [{ data: profiles }, { data: employees }, { data: variantsData }] = await Promise.all([
    admin.from("profiles").select("enroll_number, created_at").limit(10000),
    admin.from("employees").select("enroll_number, sbu, joining_date").limit(10000),
    admin.from("onboarding_variants").select("*"),
  ]);
  const variants = (variantsData ?? []).map(mapOnboardingVariant);
  const sbuOf = new Map((employees ?? []).map((e) => [e.enroll_number, e.sbu]));
  const joinedOf = new Map((employees ?? []).map((e) => [e.enroll_number, e.joining_date]));

  const due = (profiles ?? [])
    .filter((p) => !isTestEmployee(p.enroll_number))
    .map((p) => ({ enroll: p.enroll_number, day: ratingWindow(joinedOf.get(p.enroll_number) ?? null, p.created_at)?.today ?? null }))
    .filter((p): p is { enroll: string; day: number } => p.day !== null);

  const rated = new Set<string>();
  for (let i = 0; i < due.length; i += 200) {
    const { data } = await admin
      .from("day_ratings")
      .select("enroll_number, day_number")
      .in("enroll_number", due.slice(i, i + 200).map((d) => d.enroll));
    for (const r of data ?? []) rated.add(`${r.enroll_number}:${r.day_number}`);
  }
  const recipients = due.filter((d) => !rated.has(`${d.enroll}:${d.day}`));
  // ?dryRun=1: report who would be reminded, send nothing (for checking the job).
  if (req.nextUrl.searchParams.get("dryRun") === "1") {
    return NextResponse.json({ dryRun: true, wouldNotify: recipients.length, days: [...new Set(recipients.map((r) => r.day))] });
  }

  // Bell notification per person (their own day number), then one push each.
  const rows = recipients.map((r) => ({
    variant_id: resolveVariantForSbu(sbuOf.get(r.enroll), variants).id,
    recipient_enroll_number: r.enroll,
    title: "How was your day? 🌟",
    body: `Rate Day ${r.day} of your onboarding. It's anonymous and takes 5 seconds.`,
    action_url: "/ratings",
  }));
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await admin.from("notifications").insert(rows.slice(i, i + 500));
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const byDay = new Map<number, string[]>();
  for (const r of recipients) byDay.set(r.day, [...(byDay.get(r.day) ?? []), r.enroll]);
  for (const [day, enrolls] of byDay) {
    await pushToEnrolls(enrolls, {
      title: "How was your day? 🌟",
      body: `Rate Day ${day} of your onboarding. It's anonymous and takes 5 seconds.`,
      url: "/ratings",
      ttlSeconds: 6 * 60 * 60, // a 5 pm nudge is stale by midnight
    });
  }

  return NextResponse.json({ notified: recipients.length });
}
