import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ratingJoiningDate, ratingWindow, type RatingWindow } from "@/lib/day-ratings";

export type MyRatings = {
  enroll: string;
  window: RatingWindow | null; // null = not in the program (joined before Nov 2026, or past day 60)
  ratings: Map<number, { rating: number; rated_at: string }>;
  checkinsAnswered: Set<number>; // 15-day check-in days already answered
};

/** The signed-in person's rating window and ratings (service role: the table has no RLS read). */
export const getMyRatings = cache(async (): Promise<MyRatings | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("enroll_number, created_at").eq("id", user.id).single();
  if (!profile) return null;
  const admin = createAdminClient();
  const [{ data: employee }, { data }, { data: checkins }] = await Promise.all([
    admin.from("employees").select("joining_date").eq("enroll_number", profile.enroll_number).maybeSingle(),
    admin.from("day_ratings").select("day_number, rating, rated_at").eq("enroll_number", profile.enroll_number),
    admin.from("checkins").select("day_number").eq("enroll_number", profile.enroll_number),
  ]);
  return {
    enroll: profile.enroll_number,
    window: ratingWindow(ratingJoiningDate(profile.enroll_number, employee?.joining_date ?? null), profile.created_at),
    ratings: new Map((data ?? []).map((r) => [r.day_number, { rating: r.rating, rated_at: r.rated_at }])),
    checkinsAnswered: new Set((checkins ?? []).map((c) => c.day_number)),
  };
});
