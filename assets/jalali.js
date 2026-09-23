/*
 * Jalali (Persian / Solar Hijri) <-> Gregorian conversion.
 *
 * Arithmetic port of the algorithm by Kazimierz M. Borkowski as implemented in
 * jalaali-js (MIT, Behrang Noruzi Niya). Accurate for Jalali years -61 .. 3177.
 *
 * Exposed as `Jalali` in the browser and as a CommonJS module in Node.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Jalali = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Jalali years starting the 33-year rule.
  var breaks = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635,
    2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];

  function div(a, b) { return ~~(a / b); }
  function mod(a, b) { return a - ~~(a / b) * b; }

  /** Converts a Gregorian date to Jalali. Accepts (gy, gm, gd) or a Date. */
  function toJalali(gy, gm, gd) {
    if (Object.prototype.toString.call(gy) === '[object Date]') {
      gd = gy.getDate();
      gm = gy.getMonth() + 1;
      gy = gy.getFullYear();
    }
    return d2j(g2d(gy, gm, gd));
  }

  /** Converts a Jalali date to Gregorian: { gy, gm, gd }. */
  function toGregorian(jy, jm, jd) {
    return d2g(j2d(jy, jm, jd));
  }

  function isValidJalaliDate(jy, jm, jd) {
    return jy >= -61 && jy <= 3177 &&
      jm >= 1 && jm <= 12 &&
      jd >= 1 && jd <= monthLength(jy, jm);
  }

  function isLeapJalaliYear(jy) {
    return jalCalLeap(jy) === 0;
  }

  /** Number of days in month `jm` of Jalali year `jy`. */
  function monthLength(jy, jm) {
    if (jm <= 6) return 31;
    if (jm <= 11) return 30;
    return isLeapJalaliYear(jy) ? 30 : 29;
  }

  function jalCalLeap(jy) {
    var bl = breaks.length, jp = breaks[0], jm, jump, leap, n, i;
    if (jy < jp || jy >= breaks[bl - 1]) throw new Error('Invalid Jalali year ' + jy);
    for (i = 1; i < bl; i += 1) {
      jm = breaks[i];
      jump = jm - jp;
      if (jy < jm) break;
      jp = jm;
    }
    n = jy - jp;
    if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
    leap = mod(mod(n + 1, 33) - 1, 4);
    if (leap === -1) leap = 4;
    return leap;
  }

  /**
   * Determines whether `jy` is leap, the Gregorian year it starts in, and the
   * March day of Farvardin 1.
   */
  function jalCal(jy, withoutLeap) {
    var bl = breaks.length, gy = jy + 621, leapJ = -14, jp = breaks[0],
      jm, jump, leap, leapG, march, n, i;
    if (jy < jp || jy >= breaks[bl - 1]) throw new Error('Invalid Jalali year ' + jy);
    for (i = 1; i < bl; i += 1) {
      jm = breaks[i];
      jump = jm - jp;
      if (jy < jm) break;
      leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4);
      jp = jm;
    }
    n = jy - jp;
    leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
    if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
    leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
    march = 20 + leapJ - leapG;
    if (withoutLeap) return { gy: gy, march: march };
    if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
    leap = mod(mod(n + 1, 33) - 1, 4);
    if (leap === -1) leap = 4;
    return { leap: leap, gy: gy, march: march };
  }

  /** Jalali date -> Julian Day Number. */
  function j2d(jy, jm, jd) {
    var r = jalCal(jy, true);
    return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
  }

  /** Julian Day Number -> Jalali date. */
  function d2j(jdn) {
    var gy = d2g(jdn).gy, jy = gy - 621, r = jalCal(jy, false),
      jdn1f = g2d(gy, 3, r.march), jd, jm, k;
    k = jdn - jdn1f;
    if (k >= 0) {
      if (k <= 185) {
        jm = 1 + div(k, 31);
        jd = mod(k, 31) + 1;
        return { jy: jy, jm: jm, jd: jd };
      }
      k -= 186;
    } else {
      jy -= 1;
      k += 179;
      if (r.leap === 1) k += 1;
    }
    jm = 7 + div(k, 30);
    jd = mod(k, 30) + 1;
    return { jy: jy, jm: jm, jd: jd };
  }

  /** Gregorian date -> Julian Day Number. */
  function g2d(gy, gm, gd) {
    var d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4) +
      div(153 * mod(gm + 9, 12) + 2, 5) + gd - 34840408;
    d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
    return d;
  }

  /** Julian Day Number -> Gregorian date. */
  function d2g(jdn) {
    var j, i, gd, gm, gy;
    j = 4 * jdn + 139361631;
    j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
    i = div(mod(j, 1461), 4) * 5 + 308;
    gd = div(mod(i, 153), 5) + 1;
    gm = mod(div(i, 153), 12) + 1;
    gy = div(j, 1461) - 100100 + div(8 - gm, 6);
    return { gy: gy, gm: gm, gd: gd };
  }

  /** Day of week (0 = Sunday .. 6 = Saturday) of a Jalali date. */
  function weekday(jy, jm, jd) {
    // JDN 0 was a Monday; (jdn + 1) % 7 gives 0 for Sunday.
    return mod(j2d(jy, jm, jd) + 1, 7);
  }

  var MONTHS = [
    { en: 'Farvardin', fa: 'فروردین' },
    { en: 'Ordibehesht', fa: 'اردیبهشت' },
    { en: 'Khordad', fa: 'خرداد' },
    { en: 'Tir', fa: 'تیر' },
    { en: 'Mordad', fa: 'مرداد' },
    { en: 'Shahrivar', fa: 'شهریور' },
    { en: 'Mehr', fa: 'مهر' },
    { en: 'Aban', fa: 'آبان' },
    { en: 'Azar', fa: 'آذر' },
    { en: 'Dey', fa: 'دی' },
    { en: 'Bahman', fa: 'بهمن' },
    { en: 'Esfand', fa: 'اسفند' }
  ];

  // Indexed by JavaScript weekday (0 = Sunday).
  var WEEKDAYS = [
    { en: 'Sunday', fa: 'یکشنبه', watch: 'SUN' },
    { en: 'Monday', fa: 'دوشنبه', watch: 'MON' },
    { en: 'Tuesday', fa: 'سه‌شنبه', watch: 'TUE' },
    { en: 'Wednesday', fa: 'چهارشنبه', watch: 'WED' },
    { en: 'Thursday', fa: 'پنجشنبه', watch: 'THU' },
    { en: 'Friday', fa: 'جمعه', watch: 'FRI' },
    { en: 'Saturday', fa: 'شنبه', watch: 'SAT' }
  ];

  return {
    toJalali: toJalali,
    toGregorian: toGregorian,
    isValidJalaliDate: isValidJalaliDate,
    isLeapJalaliYear: isLeapJalaliYear,
    monthLength: monthLength,
    weekday: weekday,
    MONTHS: MONTHS,
    WEEKDAYS: WEEKDAYS
  };
}));
