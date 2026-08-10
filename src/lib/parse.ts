import type { ParsedCapture } from "./types";

const TAG_RE = /#([\p{L}\w-]+)/u;
const EST_RE = /~(\d+\s*[mh分時間]*)/u;
const DUE_RE = /!([\p{L}\w/]+)/u;
const STRIP_RE = /[#~!][\p{L}\w\-/]+/gu;

/**
 * Live client-side parse of the capture syntax: `#tag`, `~30m` / `~30分`, `!今日`.
 * Mirrors the prototype's regexes exactly — this is only a preview of what the
 * background AI tagging will later confirm or override.
 */
export function parseCapture(raw: string): ParsedCapture {
  const tag = TAG_RE.exec(raw)?.[1];
  const est = EST_RE.exec(raw)?.[1]?.trim();
  const due = DUE_RE.exec(raw)?.[1];
  const title = raw.replace(STRIP_RE, "").replace(/\s+/g, " ").trim();
  return { title, tag, est, due };
}

export function hasTokens(p: ParsedCapture): boolean {
  return Boolean(p.tag || p.est || p.due);
}

/** Appends a quick-insert token, keeping exactly one space before it. */
export function insertToken(value: string, token: string): string {
  if (!value || value.endsWith(" ")) return value + token;
  return value + " " + token;
}
