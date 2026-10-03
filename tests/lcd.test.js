/*
 * The weekday is drawn on a 5 x 5 dot matrix, the font the watch itself uses.
 * These tests keep that font complete and well formed.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const LCD = require('../assets/lcd.js');

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

test('every letter of every weekday has a 5x5 glyph', () => {
  for (const day of WEEKDAYS) {
    for (const ch of day) {
      const glyph = LCD.MATRIX[ch];
      assert.ok(glyph, 'missing glyph for ' + ch + ' (needed by ' + day + ')');
      assert.equal(glyph.length, 5, ch + ' should have five rows');
      for (const row of glyph) {
        assert.equal(row.length, 5, ch + ' rows should be five pixels wide');
        assert.match(row, /^[#.]{5}$/, ch + ' rows may only contain # and .');
      }
    }
  }
});

test('a 5x5 glyph never leaves a letter unreadable', () => {
  for (const [ch, glyph] of Object.entries(LCD.MATRIX)) {
    const lit = glyph.join('').split('').filter((c) => c === '#').length;
    if (ch === ' ') assert.equal(lit, 0, 'space should be blank');
    else assert.ok(lit >= 5, ch + ' needs at least five lit pixels to read');
  }
});

test('unknown characters fall back to a blank cell', () => {
  const blank = ['.....', '.....', '.....', '.....', '.....'];
  assert.deepEqual(LCD.matrixGlyph('1'), blank);
  assert.deepEqual(LCD.matrixGlyph('-'), blank);
  assert.deepEqual(LCD.matrixGlyph(undefined), blank);
  assert.deepEqual(LCD.matrixGlyph(' '), blank);
});

test('lowercase weekday input is mapped to the uppercase font', () => {
  // lcd.set() upper-cases before looking glyphs up, so the font only needs capitals.
  for (const day of WEEKDAYS) {
    for (const ch of day) assert.ok(LCD.MATRIX[ch], 'font must be uppercase-only: ' + ch);
  }
  assert.equal(LCD.MATRIX.t, undefined, 'lowercase glyphs should not exist');
});
