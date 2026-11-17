import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { currentRatingDay } from "@/lib/day-ratings";

export type MyRatings = {
  firstSignIn: string;
  today: number | null; // null once past day 90
  ratings: Map<number, { rating: number; rated_at: string }>;
};

/** The signed-in person's day ratings (service role: the table has no RLS read). */
export const getMyRatings = cache(async (): Promise<MyRatings | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("enroll_number, created_at").eq("id", user.id).single();
  if (!profile) return null;
  const { data } = await createAdminClient()
    .from("day_ratings")
    .select("day_number, rating, rated_at")
    .eq("enroll_number", profile.enroll_number);
  return {
    firstSignIn: profile.created_at,
    today: currentRatingDay(profile.created_at),
    ratings: new Map((data ?? []).map((r) => [r.day_number, { rating: r.rating, rated_at: r.rated_at }])),
  };
});
