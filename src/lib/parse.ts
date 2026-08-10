import type { ParsedCapture } from "./types";

const TAG_RE = /#([\p{L}\w-]+)/u;
const EST_RE = /~(\d+\s*[mh分時間]*)/u;
const DUE_RE = /!([\p{L}\w/]+)/u;
const STRIP_RE = /[#~!][\p{L}\w\-/]+/gu;
/** A leftover lone marker once its token has been stripped, e.g. the `!!` flag. */
const LONE_MARKER_RE = /(^|\s)[#~!]+(?=\s|$)/gu;

/**
 * Live client-side parse of the capture syntax:
 *   `#tag`   controlled-vocabulary tag
 *   `~30m`   estimate (also 分 / 時間)
 *   `!明日`   due date
 *   `!!`     important
 *
 * `!!` is deliberately separate from `!due`. The handoff had a due token imply
 * importance, which was fine while dates were decorative — but once dates drive
 * the 今日 view, "important" would just mean "has a date" and stop being a
 * signal. `!!明日` still reads naturally as important-and-due-tomorrow.
 */
export function parseCapture(raw: string): ParsedCapture {
  const important = /!!/u.test(raw);
  // Collapse `!!` to `!` so `!!明日` still yields a due of 明日, and a bare
  // `!!` collapses to a lone `!` that matches no due token.
  const normalized = raw.replace(/!!+/gu, "!");

  const tag = TAG_RE.exec(normalized)?.[1];
  const est = EST_RE.exec(normalized)?.[1]?.trim();
  const due = DUE_RE.exec(normalized)?.[1];
  const title = normalized
    .replace(STRIP_RE, " ")
    .replace(LONE_MARKER_RE, " ")
    .replace(/\s+/g, " ")
    .trim();

  return { title, tag, est, due, important };
}

export function hasTokens(p: ParsedCapture): boolean {
  return Boolean(p.tag || p.est || p.due || p.important);
}

/** Appends a quick-insert token, keeping exactly one space before it. */
export function insertToken(value: string, token: string): string {
  if (!value || value.endsWith(" ")) return value + token;
  return value + " " + token;
}
