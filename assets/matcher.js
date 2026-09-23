/*
 * Finds Gregorian years in which a given month/day falls on a given weekday.
 *
 * The watch keeps a Gregorian auto-calendar for the years 2000..2099 and derives
 * the weekday from year/month/day. To display a Jalali month/day with the correct
 * weekday, we look for a Gregorian year Y in which Y-month-day has that weekday.
 *
 * Exposed as `Matcher` in the browser and as a CommonJS module in Node.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Matcher = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MIN_YEAR = 2000;
  var MAX_YEAR = 2099;

  var MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  function isGregorianLeap(y) {
    return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  }

  function gregorianMonthLength(y, m) {
    if (m === 2 && isGregorianLeap(y)) return 29;
    return MONTH_DAYS[m - 1];
  }

  /** Longest this Gregorian month can ever be (29 for February). */
  function maxGregorianMonthLength(m) {
    return m === 2 ? 29 : MONTH_DAYS[m - 1];
  }

  /** Day of week (0 = Sunday .. 6 = Saturday) of a Gregorian date. Sakamoto's method. */
  function weekdayOf(y, m, d) {
    var t = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
    if (m < 3) y -= 1;
    return (y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) + t[m - 1] + d) % 7;
  }

  /**
   * All years in [minYear, maxYear] where month/day exists and falls on `weekday`.
   * Returns an ascending array (possibly empty when the day never exists, e.g. 4-31).
   */
  function findYears(month, day, weekday, opts) {
    opts = opts || {};
    var minYear = opts.minYear === undefined ? MIN_YEAR : opts.minYear;
    var maxYear = opts.maxYear === undefined ? MAX_YEAR : opts.maxYear;
    var years = [];
    if (!(month >= 1 && month <= 12) || !(day >= 1) || !(weekday >= 0 && weekday <= 6)) return years;
    for (var y = minYear; y <= maxYear; y += 1) {
      if (day > gregorianMonthLength(y, month)) continue;
      if (weekdayOf(y, month, day) === weekday) years.push(y);
    }
    return years;
  }

  /**
   * The year from `years` closest to `reference`. On a tie the later year wins
   * (so the watch's date leans towards the future rather than the past).
   */
  function closestYear(years, reference) {
    if (!years || !years.length) return null;
    var best = null, bestDist = Infinity;
    for (var i = 0; i < years.length; i += 1) {
      var dist = Math.abs(years[i] - reference);
      if (dist < bestDist || (dist === bestDist && years[i] > best)) {
        best = years[i];
        bestDist = dist;
      }
    }
    return best;
  }

  /**
   * Why a month/day can never be displayed (or null when it can).
   * Jalali months 1..6 have 31 days while Gregorian February, April and June are
   * shorter, so 2-30, 2-31, 4-31 and 6-31 do not exist on the watch.
   */
  function impossibleReason(month, day) {
    var max = maxGregorianMonthLength(month);
    if (day <= max) return null;
    return { month: month, day: day, maxDay: max };
  }

  /**
   * How many more days the watch keeps showing the right Jalali day after being
   * set to Gregorian (year, month, day) on Jalali day `jalaliDay` of a month with
   * `jalaliMonthLength` days. Both calendars advance one day at a time, so the
   * display stays right until one of the two months ends.
   */
  function daysInSync(year, month, day, jalaliMonthLength) {
    var gregorianLeft = gregorianMonthLength(year, month) - day;
    var jalaliLeft = jalaliMonthLength - day;
    return Math.max(0, Math.min(gregorianLeft, jalaliLeft));
  }

  return {
    MIN_YEAR: MIN_YEAR,
    MAX_YEAR: MAX_YEAR,
    isGregorianLeap: isGregorianLeap,
    gregorianMonthLength: gregorianMonthLength,
    maxGregorianMonthLength: maxGregorianMonthLength,
    weekdayOf: weekdayOf,
    findYears: findYears,
    closestYear: closestYear,
    impossibleReason: impossibleReason,
    daysInSync: daysInSync
  };
}));
