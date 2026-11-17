// Daily "rate your day" feature. Day 1 is the person's first day in the app,
// but never earlier than the feature launch, so existing users don't start
// with a long backlog of days they can't remember.
export const RATING_LAUNCH = "2026-11-17";
export const MAX_RATING_DAYS = 90;
export const RATING_HOUR = 17; // 5 pm Dhaka

export const RATING_FACES = [
  { value: 1, emoji: "😞", label: "Very bad" },
  { value: 2, emoji: "😕", label: "Bad" },
  { value: 3, emoji: "😐", label: "Okay" },
  { value: 4, emoji: "🙂", label: "Good" },
  { value: 5, emoji: "😄", label: "Great" },
] as const;

/** YYYY-MM-DD in Dhaka time. */
export function dhakaDate(d: Date | string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date(d));
}

export function dhakaHour(d: Date = new Date()): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dhaka", hour: "numeric", hourCycle: "h23" }).format(d));
}

/** Today's onboarding day number (1-based), or null once past the last rated day. */
export function currentRatingDay(firstSignIn: string, now: Date = new Date()): number | null {
  const start = [dhakaDate(firstSignIn), RATING_LAUNCH].sort()[1];
  const days = Math.round((Date.parse(dhakaDate(now)) - Date.parse(start)) / 86_400_000) + 1;
  if (days < 1) return 1;
  return days > MAX_RATING_DAYS ? null : days;
}

/** Calendar date (YYYY-MM-DD) of a given day number, for labels. */
export function dateOfRatingDay(firstSignIn: string, day: number): string {
  const start = [dhakaDate(firstSignIn), RATING_LAUNCH].sort()[1];
  return new Date(Date.parse(start) + (day - 1) * 86_400_000).toISOString().slice(0, 10);
}
