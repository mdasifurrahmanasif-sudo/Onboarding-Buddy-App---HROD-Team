// Self-check: node --experimental-strip-types lib/day-ratings.check.mjs
import assert from "node:assert";
const m = await import("./day-ratings.ts");
const at = (s) => new Date(s);
// Signed in long before launch: day 1 is launch day (Dhaka).
assert.equal(m.currentRatingDay("2026-09-01T05:00:00Z", at("2026-11-17T12:00:00Z")), 1);
assert.equal(m.currentRatingDay("2026-09-01T05:00:00Z", at("2026-11-19T12:00:00Z")), 3);
// 23:30 UTC on 17 Nov is 05:30 on 18 Nov in Dhaka -> day 2.
assert.equal(m.currentRatingDay("2026-09-01T05:00:00Z", at("2026-11-17T23:30:00Z")), 2);
// Signed in after launch: day 1 is their first day.
assert.equal(m.currentRatingDay("2026-11-20T04:00:00Z", at("2026-11-20T15:00:00Z")), 1);
assert.equal(m.currentRatingDay("2026-11-20T04:00:00Z", at("2026-11-29T10:00:00Z")), 10);
// Past day 90: no more rating.
assert.equal(m.currentRatingDay("2026-11-17T04:00:00Z", at("2027-02-14T10:00:00Z")), 90);
assert.equal(m.currentRatingDay("2026-11-17T04:00:00Z", at("2027-02-15T10:00:00Z")), null);
assert.equal(m.dateOfRatingDay("2026-09-01T05:00:00Z", 3), "2026-11-19");
assert.equal(m.dhakaHour(at("2026-11-17T11:00:00Z")), 17);
assert.equal(m.dhakaDate("2026-11-17T19:00:00Z"), "2026-11-18");
console.log("day-ratings self-check OK");
