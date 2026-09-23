/* UI wiring for the Jalali Year Finder. Depends on jalali.js, matcher.js and lcd.js. */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };

  var els = {
    watch: $('watch'), lcd: $('lcd'),
    result: $('result'), resultLabel: $('resultLabel'), resultYear: $('resultYear'),
    resultDetail: $('resultDetail'), resultMeta: $('resultMeta'),
    modeToday: $('modeToday'), modeCustom: $('modeCustom'),
    jy: $('jy'), jm: $('jm'), jd: $('jd'), wd: $('wd'),
    jdHint: $('jdHint'), wdHint: $('wdHint'),
    hour12: $('hour12'), resetBtn: $('resetBtn'), miniAnswer: $('miniAnswer')
  };

  var GREGORIAN_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December'];
  var WEEK_ORDER = [6, 0, 1, 2, 3, 4, 5]; // Saturday first, as in Iran
  var STORAGE_KEY = 'jalali-year-finder:hour12';
  var BACKLIGHT_MS = 1500; // "LT1" on the watch

  var state = {
    mode: 'today',
    jy: 1405, jm: 1, jd: 1,
    weekday: 0,
    weekdayManual: false,
    hour12: false,
    todayKey: ''
  };

  var lcd = LCD.mount(els.lcd);

  /* --------------------------------------------------------------- helpers */
  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function faDigits(value) {
    return String(value).replace(/\d/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.charAt(Number(d)); });
  }

  function todayJalali() {
    var now = new Date();
    var j = Jalali.toJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
    return { jy: j.jy, jm: j.jm, jd: j.jd, weekday: now.getDay(), key: now.toDateString() };
  }

  /** Month-day exactly as the watch prints it: blank tens digits, e.g. " 7- 1". */
  function watchDate(m, d) {
    return (m < 10 ? ' ' : '') + m + '-' + (d < 10 ? ' ' : '') + d;
  }

  function textDate(m, d) { return m + '-' + d; }

  function jalaliLong(jy, jm, jd, weekday) {
    var wd = weekday === undefined ? Jalali.weekday(jy, jm, jd) : weekday;
    return Jalali.WEEKDAYS[wd].en + ', ' + jd + ' ' + Jalali.MONTHS[jm - 1].en + ' ' + jy;
  }

  function jalaliFa(jy, jm, jd, weekday) {
    var wd = weekday === undefined ? Jalali.weekday(jy, jm, jd) : weekday;
    return Jalali.WEEKDAYS[wd].fa + ' ' + faDigits(jy + '/' + pad2(jm) + '/' + pad2(jd));
  }

  function gregorianLong(jy, jm, jd) {
    var g = Jalali.toGregorian(jy, jm, jd);
    var wd = Matcher.weekdayOf(g.gy, g.gm, g.gd);
    return Jalali.WEEKDAYS[wd].en + ', ' + g.gd + ' ' + GREGORIAN_MONTHS[g.gm - 1] + ' ' + g.gy;
  }

  function nextJalaliMonth(jy, jm) {
    return jm === 12 ? { jy: jy + 1, jm: 1 } : { jy: jy, jm: jm + 1 };
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* ------------------------------------------------------------- populate */
  function fillMonths() {
    els.jm.innerHTML = '';
    Jalali.MONTHS.forEach(function (m, i) {
      var opt = document.createElement('option');
      opt.value = String(i + 1);
      opt.textContent = (i + 1) + ' \u00b7 ' + m.en + ' \u00b7 ' + m.fa;
      els.jm.appendChild(opt);
    });
  }

  function fillWeekdays() {
    els.wd.innerHTML = '';
    WEEK_ORDER.forEach(function (w) {
      var opt = document.createElement('option');
      opt.value = String(w);
      opt.textContent = Jalali.WEEKDAYS[w].en + ' \u00b7 ' + Jalali.WEEKDAYS[w].fa;
      els.wd.appendChild(opt);
    });
  }

  function fillDays() {
    var length = Jalali.monthLength(state.jy, state.jm);
    if (state.jd > length) state.jd = length;
    els.jd.innerHTML = '';
    for (var d = 1; d <= length; d += 1) {
      var opt = document.createElement('option');
      opt.value = String(d);
      opt.textContent = String(d);
      els.jd.appendChild(opt);
    }
    els.jd.value = String(state.jd);
    els.jdHint.textContent = Jalali.MONTHS[state.jm - 1].en + ' has ' + length + ' days' +
      (state.jm === 12 ? (Jalali.isLeapJalaliYear(state.jy) ? ' (leap year)' : '') : '');
  }

  /* --------------------------------------------------------------- state */
  function applyToday() {
    var t = todayJalali();
    state.jy = t.jy; state.jm = t.jm; state.jd = t.jd;
    state.weekday = t.weekday;
    state.weekdayManual = false;
    state.todayKey = t.key;
  }

  function setMode(mode) {
    state.mode = mode;
    if (mode === 'today') applyToday();
    var custom = mode === 'custom';
    els.modeToday.setAttribute('aria-selected', String(!custom));
    els.modeCustom.setAttribute('aria-selected', String(custom));
    [els.jy, els.jm, els.jd, els.wd].forEach(function (el) { el.disabled = !custom; });
    els.resetBtn.disabled = !custom;
    syncInputs();
    render();
  }

  function syncInputs() {
    els.jy.value = String(state.jy);
    els.jm.value = String(state.jm);
    fillDays();
    els.wd.value = String(state.weekday);
    var actual = Jalali.weekday(state.jy, state.jm, state.jd);
    if (state.weekdayManual && actual !== state.weekday) {
      els.wdHint.textContent = 'Set by hand \u2014 ' + state.jy + '/' + pad2(state.jm) + '/' + pad2(state.jd) +
        ' is actually a ' + Jalali.WEEKDAYS[actual].en;
      els.wdHint.classList.add('is-manual');
    } else {
      els.wdHint.textContent = state.mode === 'today'
        ? 'Read from your device\u2019s clock'
        : 'Follows the date above \u2014 change it if you only know the weekday';
      els.wdHint.classList.remove('is-manual');
    }
  }

  function dateChanged() {
    // Keep the day inside the (possibly shorter) month before deriving the weekday.
    state.jd = Math.min(state.jd, Jalali.monthLength(state.jy, state.jm));
    state.weekdayManual = false;
    state.weekday = Jalali.weekday(state.jy, state.jm, state.jd);
    syncInputs();
    render();
  }

  /* -------------------------------------------------------------- render */
  function render() {
    var m = state.jm, d = state.jd, w = state.weekday;
    var refYear = new Date().getFullYear();
    var years = Matcher.findYears(m, d, w);
    var chosen = Matcher.closestYear(years, refYear);
    var display = Jalali.WEEKDAYS[w].watch + ' ' + textDate(m, d);

    var meta = [];
    meta.push(['Jalali date',
      '<span class="fa">' + escapeHtml(jalaliFa(state.jy, m, d, w)) + '</span> \u00b7 ' +
      escapeHtml(jalaliLong(state.jy, m, d, w))]);
    meta.push(['Gregorian date', escapeHtml(gregorianLong(state.jy, m, d))]);

    if (chosen === null) {
      var why = Matcher.impossibleReason(m, d);
      els.result.classList.add('result--none');
      els.resultLabel.textContent = 'No year works';
      els.resultYear.textContent = 'Not displayable';
      els.resultDetail.innerHTML =
        'Gregorian month ' + m + ' never has a day ' + d + ' (at most ' + (why ? why.maxDay : '') + '), so ' +
        '<b>' + escapeHtml(display) + '</b> cannot appear on the watch in any year. ' +
        'Leave the watch as it is: it rolls on to <b>' + escapeHtml(Jalali.WEEKDAYS[w].watch + ' ' + textDate(m + 1, 1)) +
        '</b> with the correct weekday, then set it again on 1 ' + Jalali.MONTHS[m % 12].en + '.';
      renderMeta(meta);
      els.miniAnswer.innerHTML = '<b>' + escapeHtml(display) + '</b> cannot be displayed \u2014 see above';
    } else {
      els.result.classList.remove('result--none');
      els.resultLabel.textContent = 'Set the year to';
      els.resultYear.textContent = String(chosen);
      els.resultDetail.innerHTML =
        'Then set the month to <b>' + m + '</b> and the day to <b>' + d + '</b>. ' +
        'The watch will read <b>' + escapeHtml(display) + '</b> \u2014 ' +
        escapeHtml(Jalali.WEEKDAYS[w].en) + ', ' + d + ' ' + escapeHtml(Jalali.MONTHS[m - 1].en) + '.';
      meta.push(['In sync until', syncText(chosen)]);
      meta.push(['Years that work', yearsHtml(years, chosen)]);
      renderMeta(meta);
      els.miniAnswer.innerHTML = 'Set the year to <b>' + chosen + '</b> \u2014 shows ' + escapeHtml(display);
    }
    tick();
  }

  function syncText(year) {
    var m = state.jm, d = state.jd, jy = state.jy;
    var jml = Jalali.monthLength(jy, m);
    var extra = Matcher.daysInSync(year, m, d, jml);
    var lastDay = d + extra;
    var next, nextLabel;
    if (lastDay >= jml) {
      next = nextJalaliMonth(jy, m);
      nextLabel = '1 ' + Jalali.MONTHS[next.jm - 1].en + ' ' + next.jy;
    } else if (Matcher.impossibleReason(m, lastDay + 1)) {
      next = nextJalaliMonth(jy, m);
      nextLabel = '1 ' + Jalali.MONTHS[next.jm - 1].en + ' ' + next.jy + ' (' + (lastDay + 1) + ' ' +
        Jalali.MONTHS[m - 1].en + ' cannot be displayed)';
    } else {
      nextLabel = (lastDay + 1) + ' ' + Jalali.MONTHS[m - 1].en + ' ' + jy;
    }
    var through = extra === 0
      ? 'Today only'
      : 'Through ' + lastDay + ' ' + Jalali.MONTHS[m - 1].en + ' (' + extra + ' more day' + (extra === 1 ? '' : 's') + ')';
    return escapeHtml(through) + ' \u2014 set it again on <b>' + escapeHtml(nextLabel) + '</b>';
  }

  function yearsHtml(years, chosen) {
    return '<ul class="years">' + years.map(function (y) {
      return '<li' + (y === chosen ? ' class="is-chosen"' : '') + '>' + y + '</li>';
    }).join('') + '</ul>';
  }

  function renderMeta(rows) {
    els.resultMeta.innerHTML = rows.map(function (row) {
      return '<dt>' + row[0] + '</dt><dd>' + row[1] + '</dd>';
    }).join('');
  }

  /* --------------------------------------------------------------- clock */
  function tick() {
    var now = new Date();
    if (state.mode === 'today' && now.toDateString() !== state.todayKey) {
      applyToday();
      syncInputs();
      render();
      return;
    }
    var h = now.getHours(), pm = false;
    if (state.hour12) {
      pm = h >= 12;
      h = h % 12;
      if (h === 0) h = 12;
    }
    lcd.set({
      weekday: Jalali.WEEKDAYS[state.weekday].watch,
      month: state.jm, day: state.jd,
      hour: h, minute: now.getMinutes(), second: now.getSeconds(), pm: pm
    });
  }

  function scheduleTick() {
    var delay = 1000 - (Date.now() % 1000);
    setTimeout(function () { tick(); scheduleTick(); }, delay + 5);
  }

  /* ------------------------------------------------------------ backlight */
  var lightTimer = null;
  function backlight() {
    els.watch.classList.add('is-lit');
    clearTimeout(lightTimer);
    lightTimer = setTimeout(function () { els.watch.classList.remove('is-lit'); }, BACKLIGHT_MS);
  }

  /* --------------------------------------------------------------- events */
  els.modeToday.addEventListener('click', function () { setMode('today'); });
  els.modeCustom.addEventListener('click', function () { setMode('custom'); });
  els.resetBtn.addEventListener('click', function () { setMode('today'); });

  function readYear() {
    var value = parseInt(els.jy.value, 10);
    if (!isFinite(value) || value < 1300 || value > 1500) return false;
    state.jy = value;
    return true;
  }
  els.jy.addEventListener('input', function () { if (els.jy.value.length >= 4 && readYear()) dateChanged(); });
  els.jy.addEventListener('change', function () {
    if (!readYear()) els.jy.value = String(state.jy);
    dateChanged();
  });
  els.jm.addEventListener('change', function () { state.jm = parseInt(els.jm.value, 10); dateChanged(); });
  els.jd.addEventListener('change', function () { state.jd = parseInt(els.jd.value, 10); dateChanged(); });
  els.wd.addEventListener('change', function () {
    state.weekday = parseInt(els.wd.value, 10);
    state.weekdayManual = true;
    syncInputs();
    render();
  });

  els.hour12.addEventListener('change', function () {
    state.hour12 = els.hour12.checked;
    try { localStorage.setItem(STORAGE_KEY, state.hour12 ? '1' : '0'); } catch (e) { /* private mode */ }
    tick();
  });

  els.watch.addEventListener('click', backlight);
  els.watch.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); backlight(); }
  });

  document.addEventListener('visibilitychange', function () { if (!document.hidden) tick(); });

  /* ----------------------------------------------------------------- init */
  try { state.hour12 = localStorage.getItem(STORAGE_KEY) === '1'; } catch (e) { state.hour12 = false; }
  els.hour12.checked = state.hour12;
  fillMonths();
  fillWeekdays();
  setMode('today');
  scheduleTick();
}());
