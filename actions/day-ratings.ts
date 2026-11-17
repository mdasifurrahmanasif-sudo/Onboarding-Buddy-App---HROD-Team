"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMyRatings } from "@/lib/data/day-ratings";

/** Allowed: any day from the first rateable day up to today (never a future day). */
async function who(day: number): Promise<string | null> {
  const mine = await getMyRatings();
  const w = mine?.window;
  if (!mine || !w || !Number.isInteger(day) || day < w.firstDay || day > w.today) return null;
  return mine.enroll;
}

export async function saveDayRating(day: number, rating: number): Promise<{ ok: boolean }> {
  const enroll = await who(day);
  if (!enroll || !Number.isInteger(rating) || rating < 1 || rating > 5) return { ok: false };
  const { error } = await createAdminClient()
    .from("day_ratings")
    .upsert({ enroll_number: enroll, day_number: day, rating, rated_at: new Date().toISOString() });
  revalidatePath("/ratings");
  return { ok: !error };
}

/** The optional "want to share something?" note after a low rating. */
export async function saveDayComment(day: number, comment: string): Promise<{ ok: boolean }> {
  const enroll = await who(day);
  const text = String(comment ?? "").trim().slice(0, 1000);
  if (!enroll || !text) return { ok: false };
  const { error } = await createAdminClient()
    .from("day_ratings")
    .update({ comment: text })
    .eq("enroll_number", enroll)
    .eq("day_number", day);
  return { ok: !error };
}
