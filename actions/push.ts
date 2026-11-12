"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type SubscriptionInput = { endpoint: string; keys: { p256dh: string; auth: string } };

/** Saves this device for the signed-in person (re-saving moves a shared phone to the new user). */
export async function savePushSubscription(sub: SubscriptionInput): Promise<{ ok: boolean }> {
  if (!sub?.endpoint?.startsWith("https://") || !sub.keys?.p256dh || !sub.keys?.auth) return { ok: false };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };
  const { data: profile } = await supabase.from("profiles").select("enroll_number").eq("id", user.id).single();
  if (!profile?.enroll_number) return { ok: false };

  const { error } = await createAdminClient().from("push_subscriptions").upsert({
    endpoint: sub.endpoint,
    enroll_number: profile.enroll_number,
    p256dh: sub.keys.p256dh,
    auth: sub.keys.auth,
  });
  return { ok: !error };
}
