'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Jalali = require('../assets/jalali.js');

const knownDates = [
  // [gy, gm, gd, jy, jm, jd]
  [1921, 3, 21, 1300, 1, 1],
  [1970, 1, 1, 1348, 10, 11],   // Unix epoch
  [1979, 2, 11, 1357, 11, 22],
  [2000, 1, 1, 1378, 10, 11],
  [2009, 3, 20, 1387, 12, 30],  // 1387 is a leap year
  [2009, 3, 21, 1388, 1, 1],
  [2016, 3, 20, 1395, 1, 1],
  [2021, 3, 20, 1399, 12, 30],  // 1399 is a leap year
  [2021, 3, 21, 1400, 1, 1],
  [2023, 3, 21, 1402, 1, 1],
  [2024, 3, 20, 1403, 1, 1],
  [2024, 12, 31, 1403, 10, 11],
  [2025, 3, 20, 1403, 12, 30],  // 1403 is a leap year
  [2025, 3, 21, 1404, 1, 1],
  [2025, 9, 21, 1404, 6, 30],
  [2026, 3, 20, 1404, 12, 29],  // 1404 is not a leap year
  [2026, 3, 21, 1405, 1, 1],
  [2026, 9, 23, 1405, 7, 1],
];

test('converts well-known Gregorian dates to Jalali', () => {
  for (const [gy, gm, gd, jy, jm, jd] of knownDates) {
    assert.deepEqual(Jalali.toJalali(gy, gm, gd), { jy, jm, jd }, `${gy}-${gm}-${gd}`);
  }
});

test('converts well-known Jalali dates to Gregorian', () => {
  for (const [gy, gm, gd, jy, jm, jd] of knownDates) {
    assert.deepEqual(Jalali.toGregorian(jy, jm, jd), { gy, gm, gd }, `${jy}/${jm}/${jd}`);
  }
});

test('accepts a Date object', () => {
  assert.deepEqual(Jalali.toJalali(new Date(2026, 8, 23)), { jy: 1405, jm: 7, jd: 1 });
});

test('leap years and month lengths', () => {
  for (const y of [1370, 1375, 1379, 1383, 1387, 1391, 1395, 1399, 1403, 1408]) {
    assert.equal(Jalali.isLeapJalaliYear(y), true, `${y} should be leap`);
    assert.equal(Jalali.monthLength(y, 12), 30);
  }
  for (const y of [1400, 1401, 1402, 1404, 1405, 1406, 1407]) {
    assert.equal(Jalali.isLeapJalaliYear(y), false, `${y} should not be leap`);
    assert.equal(Jalali.monthLength(y, 12), 29);
  }
  for (let m = 1; m <= 6; m += 1) assert.equal(Jalali.monthLength(1405, m), 31);
  for (let m = 7; m <= 11; m += 1) assert.equal(Jalali.monthLength(1405, m), 30);
});

test('validates dates', () => {
  assert.equal(Jalali.isValidJalaliDate(1405, 6, 31), true);
  assert.equal(Jalali.isValidJalaliDate(1405, 7, 31), false);
  assert.equal(Jalali.isValidJalaliDate(1404, 12, 30), false);
  assert.equal(Jalali.isValidJalaliDate(1403, 12, 30), true);
  assert.equal(Jalali.isValidJalaliDate(1405, 13, 1), false);
  assert.equal(Jalali.isValidJalaliDate(1405, 0, 1), false);
});

test('weekday of a Jalali date matches JavaScript Date', () => {
  assert.equal(Jalali.weekday(1405, 7, 1), 3);   // 2026-09-23 is a Wednesday
  assert.equal(Jalali.weekday(1404, 6, 30), 0);  // 2025-09-21 is a Sunday
  assert.equal(Jalali.weekday(1348, 10, 11), 4); // 1970-01-01 is a Thursday
  for (let i = 0; i < 2000; i += 7) {
    const date = new Date(Date.UTC(2000, 0, 1 + i * 3));
    const j = Jalali.toJalali(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
    assert.equal(Jalali.weekday(j.jy, j.jm, j.jd), date.getUTCDay());
  }
});

test('round-trips every day from 1990 to 2100', () => {
  const start = Date.UTC(1990, 0, 1);
  const end = Date.UTC(2100, 11, 31);
  let previous = null;
  for (let t = start; t <= end; t += 86400000) {
    const date = new Date(t);
    const gy = date.getUTCFullYear(), gm = date.getUTCMonth() + 1, gd = date.getUTCDate();
    const j = Jalali.toJalali(gy, gm, gd);
    assert.ok(Jalali.isValidJalaliDate(j.jy, j.jm, j.jd), `valid ${gy}-${gm}-${gd}`);
    assert.deepEqual(Jalali.toGregorian(j.jy, j.jm, j.jd), { gy, gm, gd });
    if (previous) {
      // Consecutive days must be consecutive Jalali dates.
      const sameMonth = previous.jy === j.jy && previous.jm === j.jm && previous.jd + 1 === j.jd;
      const nextMonth = previous.jy === j.jy && previous.jm + 1 === j.jm && j.jd === 1 &&
        previous.jd === Jalali.monthLength(previous.jy, previous.jm);
      const nextYear = previous.jy + 1 === j.jy && previous.jm === 12 && j.jm === 1 && j.jd === 1 &&
        previous.jd === Jalali.monthLength(previous.jy, 12);
      assert.ok(sameMonth || nextMonth || nextYear, `continuity at ${gy}-${gm}-${gd}`);
    }
    previous = j;
  }
});

test('agrees with the ICU Persian calendar for 2000..2099', { skip: !hasPersianIntl() }, () => {
  const fmt = new Intl.DateTimeFormat('en-US-u-ca-persian-nu-latn', {
    timeZone: 'UTC', year: 'numeric', month: 'numeric', day: 'numeric',
  });
  const start = Date.UTC(2000, 0, 1);
  const end = Date.UTC(2099, 11, 31);
  for (let t = start; t <= end; t += 86400000) {
    const date = new Date(t);
    const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
    const expected = { jy: Number(parts.year), jm: Number(parts.month), jd: Number(parts.day) };
    const actual = Jalali.toJalali(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
    assert.deepEqual(actual, expected, date.toISOString().slice(0, 10));
  }
});

function hasPersianIntl() {
  try {
    const fmt = new Intl.DateTimeFormat('en-US-u-ca-persian-nu-latn', { timeZone: 'UTC', year: 'numeric' });
    return fmt.resolvedOptions().calendar === 'persian';
  } catch (e) {
    return false;
  }
}
