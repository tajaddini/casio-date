/*
 * Segment LCD renderer that mimics the timekeeping screen of a Casio 6900-series
 * module (3180): upper row = weekday + month-day, lower row = hour:minutes seconds,
 * with a "P" indicator for PM. Everything is drawn as SVG so it scales crisply.
 *
 * Exposed as `LCD` in the browser and as a CommonJS module in Node.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LCD = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';

  // Segment names: a top, b upper-right, c lower-right, d bottom, e lower-left,
  // f upper-left, g middle; p/q are the upper/lower centre verticals that letter
  // cells have in addition, which is what lets the watch draw M, W, T and I.
  var DIGITS = ['abcdef', 'bc', 'abdeg', 'abcdg', 'bcfg', 'acdfg', 'acdefg', 'abc', 'abcdefg', 'abcdfg'];
  var LETTERS = {
    A: 'abcefg', D: 'bcdeg', E: 'adefg', F: 'aefg', H: 'bcefg', I: 'pq', M: 'abcefp',
    N: 'ceg', O: 'abcdef', P: 'abefg', R: 'eg', S: 'acdfg', T: 'apq', U: 'bcdef', W: 'bcdefq',
    ' ': ''
  };

  function el(name, attrs, parent) {
    var node = document.createElementNS(NS, name);
    for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) node.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(node);
    return node;
  }

  function pts(list) {
    return list.map(function (p) { return p[0].toFixed(2) + ',' + p[1].toFixed(2); }).join(' ');
  }

  /** Horizontal segment between x1..x2 (tip to tip) centred on cy. */
  function hseg(x1, x2, cy, t) {
    var h = t / 2;
    return pts([[x1, cy], [x1 + h, cy - h], [x2 - h, cy - h], [x2, cy], [x2 - h, cy + h], [x1 + h, cy + h]]);
  }

  /** Vertical segment between y1..y2 (tip to tip) centred on cx. */
  function vseg(cx, y1, y2, t) {
    var h = t / 2;
    return pts([[cx, y1], [cx + h, y1 + h], [cx + h, y2 - h], [cx, y2], [cx - h, y2 - h], [cx - h, y1 + h]]);
  }

  /**
   * Segment outlines for a cell whose box is (x, y, w, h) with stroke thickness t.
   * `letter` adds the two centre verticals.
   */
  function cellSegments(x, y, w, h, t, letter) {
    var gap = t * 0.22;
    var xl = x + t / 2, xr = x + w - t / 2, xc = x + w / 2;
    var ya = y + t / 2, yg = y + h / 2, yd = y + h - t / 2;
    var segs = {
      a: hseg(xl + gap, xr - gap, ya, t),
      g: hseg(xl + gap, xr - gap, yg, t),
      d: hseg(xl + gap, xr - gap, yd, t),
      f: vseg(xl, ya + gap, yg - gap, t),
      e: vseg(xl, yg + gap, yd - gap, t),
      b: vseg(xr, ya + gap, yg - gap, t),
      c: vseg(xr, yg + gap, yd - gap, t)
    };
    if (letter) {
      // Centre verticals stop short of the horizontal bars so they never bleed into them.
      var inset = t / 2 + gap * 0.6;
      segs.p = vseg(xc, ya + inset, yg - inset, t);
      segs.q = vseg(xc, yg + inset, yd - inset, t);
    }
    return segs;
  }

  /** Layout in SVG user units; the drawing is 1000 x 470. */
  var VIEW = { w: 1000, h: 470 };
  var LAYOUT = {
    upper: { y: 52, h: 96, w: 66, t: 13, pitch: 88 },
    lower: { y: 196, h: 220, w: 120, t: 24, pitch: 150 },
    seconds: { y: 266, h: 150, w: 84, t: 17, pitch: 104 },
    pm: { x: 52, y: 202, w: 30, h: 46, t: 7 }
  };

  function mount(container) {
    var svg = el('svg', {
      viewBox: '0 0 ' + VIEW.w + ' ' + VIEW.h,
      class: 'lcd',
      role: 'img',
      focusable: 'false'
    });
    var defs = el('defs', {}, svg);
    var gloss = el('linearGradient', { id: 'lcd-gloss', x1: '0', y1: '0', x2: '1', y2: '1' }, defs);
    el('stop', { offset: '0', 'stop-color': '#fff', 'stop-opacity': '0.16' }, gloss);
    el('stop', { offset: '0.45', 'stop-color': '#fff', 'stop-opacity': '0.02' }, gloss);
    el('stop', { offset: '1', 'stop-color': '#fff', 'stop-opacity': '0.05' }, gloss);
    var shade = el('linearGradient', { id: 'lcd-shade', x1: '0', y1: '0', x2: '0', y2: '1' }, defs);
    el('stop', { offset: '0', 'stop-color': '#000', 'stop-opacity': '0.22' }, shade);
    el('stop', { offset: '0.08', 'stop-color': '#000', 'stop-opacity': '0' }, shade);
    el('stop', { offset: '0.92', 'stop-color': '#000', 'stop-opacity': '0' }, shade);
    el('stop', { offset: '1', 'stop-color': '#000', 'stop-opacity': '0.10' }, shade);

    el('rect', { class: 'lcd__panel', x: 0, y: 0, width: VIEW.w, height: VIEW.h, rx: 16 }, svg);

    var ghost = el('g', { class: 'lcd__ghost' }, svg);
    var ink = el('g', { class: 'lcd__ink' }, svg);

    var cells = {};

    /** `ghostOnly` limits which segments get a ghost (unlit) outline, for indicators. */
    function addCell(id, x, y, w, h, t, letter, ghostOnly) {
      var segs = cellSegments(x, y, w, h, t, letter);
      var polys = {};
      for (var name in segs) if (Object.prototype.hasOwnProperty.call(segs, name)) {
        if (!ghostOnly || ghostOnly.indexOf(name) !== -1) el('polygon', { points: segs[name] }, ghost);
        polys[name] = el('polygon', { points: segs[name] }, ink);
      }
      cells[id] = polys;
    }

    // Upper row: weekday letters on the left, month-day on the right.
    var U = LAYOUT.upper;
    var x0 = 98;
    for (var i = 0; i < 3; i += 1) addCell('wd' + i, x0 + i * U.pitch, U.y, U.w, U.h, U.t, true);

    var right = VIEW.w - 52;
    var dayOnes = right - U.w, dayTens = dayOnes - U.pitch;
    var dashX2 = dayTens - 16, dashX1 = dashX2 - 34;
    var monthOnes = dashX1 - 16 - U.w, monthTens = monthOnes - U.pitch;
    addCell('m0', monthTens, U.y, U.w, U.h, U.t);
    addCell('m1', monthOnes, U.y, U.w, U.h, U.t);
    addCell('d0', dayTens, U.y, U.w, U.h, U.t);
    addCell('d1', dayOnes, U.y, U.w, U.h, U.t);
    var dash = hseg(dashX1, dashX2, U.y + U.h / 2, U.t);
    el('polygon', { points: dash }, ghost);
    el('polygon', { points: dash, class: 'on' }, ink);

    // Lower row: P indicator, hours, colon, minutes, seconds.
    var P = LAYOUT.pm;
    addCell('pm', P.x, P.y, P.w, P.h, P.t, false, LETTERS.P);

    var L = LAYOUT.lower;
    var hx = 98;
    addCell('h0', hx, L.y, L.w, L.h, L.t);
    addCell('h1', hx + L.pitch, L.y, L.w, L.h, L.t);
    var colonX = hx + L.pitch + L.w + 28;
    var colonSize = 22;
    [0.31, 0.69].forEach(function (f) {
      var cy = L.y + L.h * f;
      var sq = pts([[colonX, cy - colonSize / 2], [colonX + colonSize, cy - colonSize / 2],
        [colonX + colonSize, cy + colonSize / 2], [colonX, cy + colonSize / 2]]);
      el('polygon', { points: sq }, ghost);
      el('polygon', { points: sq, class: 'on colon' }, ink);
    });
    var mx = colonX + colonSize + 28;
    addCell('n0', mx, L.y, L.w, L.h, L.t);
    addCell('n1', mx + L.pitch, L.y, L.w, L.h, L.t);

    var S = LAYOUT.seconds;
    var sx = mx + L.pitch + L.w + 44;
    addCell('s0', sx, S.y, S.w, S.h, S.t);
    addCell('s1', sx + S.pitch, S.y, S.w, S.h, S.t);

    el('rect', { class: 'lcd__shade', x: 0, y: 0, width: VIEW.w, height: VIEW.h, rx: 16, fill: 'url(#lcd-shade)' }, svg);
    el('rect', { class: 'lcd__gloss', x: 0, y: 0, width: VIEW.w, height: VIEW.h, rx: 16, fill: 'url(#lcd-gloss)' }, svg);

    container.appendChild(svg);

    function light(id, segments) {
      var polys = cells[id];
      for (var name in polys) if (Object.prototype.hasOwnProperty.call(polys, name)) {
        var on = segments.indexOf(name) !== -1;
        if (on) polys[name].classList.add('on'); else polys[name].classList.remove('on');
      }
    }

    function digit(id, value) {
      light(id, value === null || value === undefined ? '' : DIGITS[value]);
    }

    /** Two-digit number; the tens cell is blank (not 0) when `padZero` is false. */
    function number(idTens, idOnes, value, padZero) {
      var tens = Math.floor(value / 10) % 10, ones = value % 10;
      digit(idTens, value < 10 && !padZero ? null : tens);
      digit(idOnes, ones);
    }

    /**
     * state = { weekday: 'MON', month, day, hour, minute, second, pm }
     * `hour` is already in display form (1-12 or 0-23).
     */
    function set(state) {
      var wd = (state.weekday || '   ').toUpperCase();
      for (var k = 0; k < 3; k += 1) light('wd' + k, LETTERS[wd.charAt(k)] || '');
      number('m0', 'm1', state.month, false);
      number('d0', 'd1', state.day, false);
      number('h0', 'h1', state.hour, false);
      number('n0', 'n1', state.minute, true);
      number('s0', 's1', state.second, true);
      light('pm', state.pm ? LETTERS.P : '');
      svg.setAttribute('aria-label', describe(state));
    }

    function pad(n) { return (n < 10 ? '0' : '') + n; }

    function describe(state) {
      return 'Watch display: ' + (state.weekday || '') + ' ' + state.month + '-' + state.day + ', ' +
        (state.pm ? 'PM ' : '') + state.hour + ':' + pad(state.minute) + ':' + pad(state.second);
    }

    return { svg: svg, set: set };
  }

  return { mount: mount, DIGITS: DIGITS, LETTERS: LETTERS, cellSegments: cellSegments };
}));
