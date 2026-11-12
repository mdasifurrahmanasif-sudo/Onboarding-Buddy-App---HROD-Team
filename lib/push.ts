import "server-only";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

export type PushMessage = { title: string; body: string; url?: string | null };

const BATCH = 50;

/**
 * Sends a phone notification to every saved device of these people. The
 * in-app notification row is the source of truth; this is best effort, so it
 * never throws and is a no-op when the VAPID keys aren't configured.
 */
export async function pushToEnrolls(enrollNumbers: string[], msg: PushMessage): Promise<void> {
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || enrollNumbers.length === 0) return;
  try {
    webpush.setVapidDetails(VAPID_SUBJECT || "mailto:career@akijresource.com", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    const admin = createAdminClient();
    const subs: { endpoint: string; p256dh: string; auth: string }[] = [];
    for (let i = 0; i < enrollNumbers.length; i += 200) {
      const { data } = await admin
        .from("push_subscriptions")
        .select("endpoint, p256dh, auth")
        .in("enroll_number", enrollNumbers.slice(i, i + 200));
      subs.push(...(data ?? []));
    }

    const payload = JSON.stringify({ title: msg.title, body: msg.body, url: msg.url || "/notifications" });
    const gone: string[] = [];
    for (let i = 0; i < subs.length; i += BATCH) {
      await Promise.all(
        subs.slice(i, i + BATCH).map((s) =>
          webpush
            .sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, {
              TTL: 24 * 60 * 60,
              urgency: "high",
            })
            .catch((err: { statusCode?: number }) => {
              // 404/410: app uninstalled or permission revoked — forget the device.
              if (err.statusCode === 404 || err.statusCode === 410) gone.push(s.endpoint);
            }),
        ),
      );
    }
    if (gone.length) await admin.from("push_subscriptions").delete().in("endpoint", gone);
  } catch (e) {
    console.error("push failed", e);
  }
}
