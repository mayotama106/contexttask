/**
 * Resolves the free-text `!due` token a user typed into an actual date.
 *
 * Capture stores the raw token so the user's own words survive; this turns it
 * into a timestamp so the 今日 view can filter on it. Anything unrecognised
 * resolves to null and simply never matches a date filter.
 */

const DAY = 86_400_000;

export function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

const RELATIVE: Array<[RegExp, number]> = [
  [/^(今日|きょう|本日|today)$/i, 0],
  [/^(明日|あした|あす|tomorrow)$/i, 1],
  [/^(明後日|あさって)$/i, 2],
  [/^(明々後日|しあさって)$/i, 3],
  [/^(来週|nextweek)$/i, 7],
];

// 0 = Sunday, matching Date#getDay.
const WEEKDAYS: Array<[RegExp, number]> = [
  [/^(日曜日?|日|sun(day)?)$/i, 0],
  [/^(月曜日?|月|mon(day)?)$/i, 1],
  [/^(火曜日?|火|tue(s(day)?)?)$/i, 2],
  [/^(水曜日?|水|wed(nesday)?)$/i, 3],
  [/^(木曜日?|木|thu(r(s(day)?)?)?)$/i, 4],
  [/^(金曜日?|金|fri(day)?)$/i, 5],
  [/^(土曜日?|土|sat(urday)?)$/i, 6],
];

/** Next occurrence of `weekday`, counting today as a match. */
function nextWeekday(from: number, weekday: number): number {
  const today = startOfDay(from);
  const delta = (weekday - new Date(today).getDay() + 7) % 7;
  return today + delta * DAY;
}

/** Builds a date in the given year, clamping impossible days (e.g. 2/31). */
function makeDate(year: number, month: number, day: number): number | null {
  const d = new Date(year, month - 1, day);
  d.setHours(0, 0, 0, 0);
  // Reject rolled-over dates rather than silently accepting 2/31 → 3/3.
  if (d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return d.getTime();
}

export function resolveDue(token: string | undefined, now = Date.now()): number | null {
  if (!token) return null;
  const t = token.trim();
  if (!t) return null;
  const today = startOfDay(now);

  for (const [re, offset] of RELATIVE) {
    if (re.test(t)) return today + offset * DAY;
  }

  if (/^(今週末|週末|weekend)$/i.test(t)) return nextWeekday(now, 6);

  for (const [re, weekday] of WEEKDAYS) {
    if (re.test(t)) return nextWeekday(now, weekday);
  }

  // 3日後 / 2週間後
  const after = /^(\d+)(日|週間?)後$/.exec(t);
  if (after) {
    const n = Number(after[1]);
    return today + n * (after[2].startsWith("週") ? 7 : 1) * DAY;
  }

  // 2026/8/14, 2026-08-14
  const full = /^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/.exec(t);
  if (full) return makeDate(Number(full[1]), Number(full[2]), Number(full[3]));

  // 8/14, 8-14 — this year, or next year if already past.
  const md = /^(\d{1,2})[/\-.](\d{1,2})$/.exec(t);
  if (md) {
    const year = new Date(today).getFullYear();
    const candidate = makeDate(year, Number(md[1]), Number(md[2]));
    if (candidate === null) return null;
    return candidate < today ? makeDate(year + 1, Number(md[1]), Number(md[2])) : candidate;
  }

  // 14日 — this month, or next month if already past.
  const dayOnly = /^(\d{1,2})日$/.exec(t);
  if (dayOnly) {
    const ref = new Date(today);
    const candidate = makeDate(ref.getFullYear(), ref.getMonth() + 1, Number(dayOnly[1]));
    if (candidate !== null && candidate >= today) return candidate;
    const next = new Date(ref.getFullYear(), ref.getMonth() + 1, 1);
    return makeDate(next.getFullYear(), next.getMonth() + 1, Number(dayOnly[1]));
  }

  return null;
}

export function isDueToday(dueAt: number | null | undefined, now = Date.now()): boolean {
  return dueAt != null && dueAt === startOfDay(now);
}

export function isOverdue(dueAt: number | null | undefined, now = Date.now()): boolean {
  return dueAt != null && dueAt < startOfDay(now);
}

/** Short label for the task row: 今日 / 明日 / 3日超過 / 8/14. */
export function dueLabel(dueAt: number | null | undefined, now = Date.now()): string | null {
  if (dueAt == null) return null;
  const days = Math.round((dueAt - startOfDay(now)) / DAY);
  if (days === 0) return "今日";
  if (days === 1) return "明日";
  if (days === 2) return "明後日";
  if (days < 0) return `${String(-days)}日超過`;
  if (days <= 7) return `${String(days)}日後`;
  const d = new Date(dueAt);
  return `${String(d.getMonth() + 1)}/${String(d.getDate())}`;
}
