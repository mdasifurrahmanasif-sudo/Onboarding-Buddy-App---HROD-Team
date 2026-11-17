// Self-check: node --experimental-strip-types lib/day-ratings.check.mjs
import assert from "node:assert";
const m = await import("./day-ratings.ts");
const at = (s) => new Date(s);
const SIGN = "2026-11-10T05:00:00Z";

// Joined before 1 Nov: not in the program.
assert.equal(m.ratingWindow("2026-10-31", SIGN, at("2026-11-17T12:00:00Z")), null);
// Joined 5 Nov: today (17 Nov) is Day 13; days before launch can't be rated.
assert.deepEqual(m.ratingWindow("2026-11-05", SIGN, at("2026-11-17T12:00:00Z")), { start: "2026-11-05", firstDay: 13, today: 13 });
assert.deepEqual(m.ratingWindow("2026-11-05", SIGN, at("2026-11-20T12:00:00Z")), { start: "2026-11-05", firstDay: 13, today: 16 });
// Future joiner: Day 1 on joining day, all days rateable.
assert.deepEqual(m.ratingWindow("2026-12-01", SIGN, at("2026-12-01T12:00:00Z")), { start: "2026-12-01", firstDay: 1, today: 1 });
// Signed in before their joining date: not started yet.
assert.equal(m.ratingWindow("2026-12-01", SIGN, at("2026-11-30T12:00:00Z")), null);
// Day 60 is the last; Day 61 is out. 1 Dec + 59 days = 29 Jan.
assert.equal(m.ratingWindow("2026-12-01", SIGN, at("2027-01-29T12:00:00Z")).today, 60);
assert.equal(m.ratingWindow("2026-12-01", SIGN, at("2027-01-30T12:00:00Z")), null);
// 23:30 UTC is next morning in Dhaka.
assert.equal(m.ratingWindow("2026-12-01", SIGN, at("2026-12-01T23:30:00Z")).today, 2);
// No joining date: fall back to first sign-in.
assert.equal(m.ratingWindow(null, "2026-11-20T03:00:00Z", at("2026-11-21T12:00:00Z")).today, 2);
assert.equal(m.dateOfRatingDay("2026-11-05", 13), "2026-11-17");
assert.equal(m.dhakaHour(at("2026-11-17T11:00:00Z")), 17);
console.log("day-ratings self-check OK");
// Tester: treated as joining on launch day, so today is Day 1.
assert.equal(m.ratingJoiningDate("570204", "2026-09-01"), m.RATING_LAUNCH);
assert.equal(m.ratingJoiningDate("123456", "2026-09-01"), "2026-09-01");
assert.equal(m.ratingWindow(m.ratingJoiningDate("570204", "2026-09-01"), SIGN, at("2026-11-17T12:00:00Z")).today, 1);
console.log("tester self-check OK");
// Check-ins: Day 15/30/45/60, only once the day has arrived and after launch.
const W = (start, firstDay, today) => ({ start, firstDay, today });
assert.equal(m.isCheckinDay(W("x", 1, 15)), true);
assert.equal(m.isCheckinDay(W("x", 1, 16)), false);
assert.equal(m.latestCheckinDay(W("x", 1, 14)), null);
assert.equal(m.latestCheckinDay(W("x", 1, 29)), 15);
assert.equal(m.latestCheckinDay(W("x", 1, 60)), 60);
// Joined 1 Nov: Day 15 (15 Nov) was before launch, so nothing until Day 30.
assert.equal(m.latestCheckinDay(W("2026-11-01", 17, 17)), null);
assert.equal(m.latestCheckinDay(W("2026-11-01", 17, 30)), 30);
console.log("checkin self-check OK");
