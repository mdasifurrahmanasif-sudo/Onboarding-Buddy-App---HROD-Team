"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { currentRatingDay } from "@/lib/day-ratings";

async function me(): Promise<{ enroll: string; today: number } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("enroll_number, created_at").eq("id", user.id).single();
  if (!profile) return null;
  const today = currentRatingDay(profile.created_at);
  return today ? { enroll: profile.enroll_number, today } : null;
}

/** Rate today or any earlier missed day (never a future day). */
export async function saveDayRating(day: number, rating: number): Promise<{ ok: boolean }> {
  const who = await me();
  if (!who || !Number.isInteger(day) || day < 1 || day > who.today) return { ok: false };
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { ok: false };
  const { error } = await createAdminClient()
    .from("day_ratings")
    .upsert({ enroll_number: who.enroll, day_number: day, rating, rated_at: new Date().toISOString() });
  revalidatePath("/ratings");
  return { ok: !error };
}

/** The optional "want to share something?" note after a low rating. */
export async function saveDayComment(day: number, comment: string): Promise<{ ok: boolean }> {
  const who = await me();
  const text = String(comment ?? "").trim().slice(0, 1000);
  if (!who || !text || !Number.isInteger(day) || day < 1 || day > who.today) return { ok: false };
  const { error } = await createAdminClient()
    .from("day_ratings")
    .update({ comment: text })
    .eq("enroll_number", who.enroll)
    .eq("day_number", day);
  return { ok: !error };
}
