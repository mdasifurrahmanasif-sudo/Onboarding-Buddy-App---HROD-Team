// Daily "rate your day" feature, for new joiners only.
//  - Who: people who joined on/after ELIGIBLE_FROM (and everyone joining later).
//  - Day N: counted from the joining date (Day 1 = joining day).
//  - Window: first MAX_RATING_DAYS days; days before RATING_LAUNCH can't be
//    rated (nobody was asked then).
export const RATING_LAUNCH = "2026-11-17";
export const ELIGIBLE_FROM = "2026-11-01";
export const MAX_RATING_DAYS = 60;
export const RATING_HOUR = 17; // 5 pm Dhaka

// Testers who get the feature exactly like a new joiner, starting at launch
// (to check what employees see). Remove an enroll to take them out.
export const RATING_TESTERS: readonly string[] = ["570204"];

/** Joining date the rating window uses: testers start on launch day. */
export function ratingJoiningDate(enroll: string, joiningDate: string | null): string | null {
  return RATING_TESTERS.includes(enroll) ? RATING_LAUNCH : joiningDate;
}

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

const dayDiff = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);

export type RatingWindow = { start: string; firstDay: number; today: number };

/**
 * Which days this person can rate right now, or null if they're not in the
 * program (joined before ELIGIBLE_FROM, or past day MAX_RATING_DAYS).
 * joiningDate falls back to first sign-in when PeopleDesk has none.
 */
export function ratingWindow(joiningDate: string | null, firstSignIn: string, now: Date = new Date()): RatingWindow | null {
  const start = joiningDate ? joiningDate.slice(0, 10) : dhakaDate(firstSignIn);
  if (start < ELIGIBLE_FROM) return null;
  const today = dayDiff(start, dhakaDate(now)) + 1;
  if (today < 1 || today > MAX_RATING_DAYS) return null;
  const firstDay = Math.max(1, dayDiff(start, RATING_LAUNCH) + 1);
  return today < firstDay ? null : { start, firstDay, today };
}

// 15-day check-in: same people and window as day ratings.
export const CHECKIN_EVERY = 15;
export const CHECKIN_HOUR = 10; // 10 am Dhaka
export const CHECKIN_MOODS = [
  { value: "good", label: "All good, going well" },
  { value: "mixed", label: "Mostly fine, a few things" },
  { value: "bad", label: "Not great, I could use help" },
] as const;
export type CheckinMood = (typeof CHECKIN_MOODS)[number]["value"];

/** Is today a check-in day (15, 30, 45, 60)? */
export const isCheckinDay = (w: RatingWindow) => w.today % CHECKIN_EVERY === 0;

/** The latest check-in day that has arrived (and was after launch), or null. */
export function latestCheckinDay(w: RatingWindow): number | null {
  const d = Math.floor(w.today / CHECKIN_EVERY) * CHECKIN_EVERY;
  return d >= CHECKIN_EVERY && d >= w.firstDay ? d : null;
}

/** Calendar date (YYYY-MM-DD) of day N, for labels. */
export function dateOfRatingDay(start: string, day: number): string {
  return new Date(Date.parse(start) + (day - 1) * 86_400_000).toISOString().slice(0, 10);
}
