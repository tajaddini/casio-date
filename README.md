# Jalali Date for Digital Watches

> The entire repo is an experiment to see how capable agentic models have become. almost nothing, except this file, has been written by hand!  
> **Expect issues :D**

The idea is to show Jalali (Persian) dates on digital watches that only have the Gregorian calendar; that being almost all of them. This solution will work on any digital watch with a 2000–2099 auto-calendar.

**Live site:** https://tajaddini.github.io/casio-date/

## The trick

The watch shows the weekday, month and day, and it derives the weekday from the full date you set.
Jalali months are 29–31 days long just like Gregorian ones, so if you enter today's *Jalali* month and day as the Gregorian date, the watch
counts along correctly until the end of the month. The only thing that would be wrong is the weekday — unless you also pick a year in which that Gregorian month/day falls on the same weekday as today's Jalali date.

> Example: 30 Shahrivar (month 6, day 30) on a Monday → set the watch to **30 June 2025** (30 June 2025 was a Monday). The display reads `MON 6-30`.

The app searches 2000–2099 for such years and shows the one closest to the current year in bold, plus every other year that works. Every weekday repeats at least once every 28 years, so a match always exists — except for 2-30, 2-31, 4-31 and 6-31, days that do not exist in the Gregorian calendar; the app says so and tells you what the watch will show instead.

Because the calendars disagree on month lengths, you re-check at the start of each Jalali month; the "in sync until" line tells you exactly when.

## Features

- Reads today's date from your device, or lets you pick any Jalali date (year / month / day, with the weekday derived automatically or set by hand).
- A faithful rendering of the watch's timekeeping screen — weekday, month-day, live time with seconds, PM indicator, 12/24-hour mode, and the EL backlight when you tap it.
- Responsive layout with light and dark themes; no build step, no dependencies, nothing leaves the browser.

## Development

The site is plain HTML/CSS/JS in `index.html` and `assets/`:

| File                | Purpose                                                    |
| ------------------- | ---------------------------------------------------------- |
| `assets/jalali.js`  | Jalali ↔ Gregorian conversion (port of jalaali-js)         |
| `assets/matcher.js` | Finds the matching Gregorian years and the sync window     |
| `assets/lcd.js`     | SVG segment-display renderer that mimics the 3180 module   |
| `assets/app.js`     | UI wiring                                                  |

```sh
npm test    # calendar + matcher tests (Node 20+; no install needed)
npm start   # serves the site at http://localhost:8000
```
