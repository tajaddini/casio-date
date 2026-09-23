'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Matcher = require('../assets/matcher.js');

const SUN = 0, MON = 1, TUE = 2, WED = 3, THU = 4, FRI = 5, SAT = 6;

test('weekdayOf agrees with JavaScript Date for the whole watch range', () => {
  for (let t = Date.UTC(2000, 0, 1); t <= Date.UTC(2099, 11, 31); t += 86400000) {
    const d = new Date(t);
    assert.equal(
      Matcher.weekdayOf(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()),
      d.getUTCDay(),
      d.toISOString().slice(0, 10),
    );
  }
});

test('month lengths', () => {
  assert.equal(Matcher.gregorianMonthLength(2024, 2), 29);
  assert.equal(Matcher.gregorianMonthLength(2025, 2), 28);
  assert.equal(Matcher.gregorianMonthLength(2000, 2), 29);
  assert.equal(Matcher.gregorianMonthLength(2100, 2), 28);
  assert.equal(Matcher.gregorianMonthLength(2026, 4), 30);
  assert.equal(Matcher.maxGregorianMonthLength(2), 29);
  assert.equal(Matcher.maxGregorianMonthLength(6), 30);
});

test("the user's example: 6-30 on a Monday", () => {
  const years = Matcher.findYears(6, 30, MON);
  assert.ok(years.includes(2025));           // 30 June 2025 was a Monday
  assert.ok(!years.includes(2026));          // 30 June 2026 is a Tuesday
  assert.equal(Matcher.closestYear(years, 2026), 2025);
  for (const y of years) assert.equal(new Date(Date.UTC(y, 5, 30)).getUTCDay(), MON);
});

test('today: 7-1 on a Wednesday resolves to 2026 itself', () => {
  const years = Matcher.findYears(7, 1, WED);
  assert.equal(Matcher.closestYear(years, 2026), 2026);
});

test('every displayable month/day/weekday combination has a match in 2000..2099', () => {
  for (let m = 1; m <= 12; m += 1) {
    for (let d = 1; d <= Matcher.maxGregorianMonthLength(m); d += 1) {
      for (let w = 0; w < 7; w += 1) {
        const years = Matcher.findYears(m, d, w);
        assert.ok(years.length > 0, `${m}-${d} weekday ${w}`);
        for (const y of years) {
          assert.ok(y >= 2000 && y <= 2099);
          assert.equal(new Date(Date.UTC(y, m - 1, d)).getUTCDay(), w);
          assert.equal(new Date(Date.UTC(y, m - 1, d)).getUTCDate(), d, 'date must exist');
        }
      }
    }
  }
});

test('a regular date matches every weekday roughly 14 times per century', () => {
  const years = Matcher.findYears(3, 15, FRI);
  assert.ok(years.length >= 14 && years.length <= 15, String(years.length));
});

test('29 February only matches leap years', () => {
  const years = Matcher.findYears(2, 29, SAT);
  assert.ok(years.length >= 3);
  for (const y of years) assert.ok(Matcher.isGregorianLeap(y));
});

test('days that never exist in the Gregorian calendar', () => {
  assert.deepEqual(Matcher.findYears(2, 30, SUN), []);
  assert.deepEqual(Matcher.findYears(2, 31, SUN), []);
  assert.deepEqual(Matcher.findYears(4, 31, TUE), []);
  assert.deepEqual(Matcher.findYears(6, 31, THU), []);
  assert.deepEqual(Matcher.impossibleReason(4, 31), { month: 4, day: 31, maxDay: 30 });
  assert.equal(Matcher.impossibleReason(2, 29), null);
  assert.equal(Matcher.impossibleReason(12, 30), null);
});

test('closestYear prefers the later year on a tie', () => {
  assert.equal(Matcher.closestYear([2021, 2031], 2026), 2031);
  assert.equal(Matcher.closestYear([2020, 2031], 2026), 2031);
  assert.equal(Matcher.closestYear([2020, 2033], 2026), 2020);
  assert.equal(Matcher.closestYear([], 2026), null);
});

test('daysInSync counts how long the display stays right', () => {
  // Set on Mehr 1 (30-day month) shown as July 1 (31 days): fine until Mehr 30.
  assert.equal(Matcher.daysInSync(2026, 7, 1, 30), 29);
  // Set on Tir 1 (31 days) shown as April 1 (30 days): fine until Tir 30.
  assert.equal(Matcher.daysInSync(2026, 4, 1, 31), 29);
  // Set on Esfand 29 of a non-leap year (last day): needs a reset tomorrow.
  assert.equal(Matcher.daysInSync(2026, 12, 29, 29), 0);
  // Set on Esfand 1 of a leap year (30 days) shown as December (31 days).
  assert.equal(Matcher.daysInSync(2027, 12, 1, 30), 29);
  // Set on Farvardin 1 shown as January 1: both 31 days.
  assert.equal(Matcher.daysInSync(2026, 1, 1, 31), 30);
});
