import { getMeta, setMeta } from "./db";

/**
 * Bring-your-own-key storage.
 *
 * The key lives only in this device's IndexedDB — it is never in the bundle,
 * the repository, or any server, and another visitor to the same URL gets their
 * own empty database. That is the whole reason this app can call the API from
 * the browser without a relay.
 *
 * It is *not* encrypted, and it cannot meaningfully be: any key the page can
 * decrypt, a script running on the page can also decrypt. Anything with script
 * access to this origin can read it. Mitigate on Anthropic's side instead —
 * scope the key narrowly and set a spend limit in the Console.
 */
const KEY = "anthropicApiKey";

export async function loadApiKey(): Promise<string | null> {
  const value = await getMeta<string>(KEY);
  return value && value.trim() ? value : null;
}

export async function saveApiKey(value: string): Promise<void> {
  await setMeta(KEY, value.trim());
}

export async function clearApiKey(): Promise<void> {
  await setMeta(KEY, "");
}

/** Cheap shape check so an obvious paste error fails before a network call. */
export function looksLikeApiKey(value: string): boolean {
  return /^sk-ant-\S{20,}$/.test(value.trim());
}

/** `sk-ant-…a1b2` — enough to recognise which key is stored, not enough to use. */
export function maskApiKey(value: string): string {
  const v = value.trim();
  if (v.length <= 12) return "…";
  return `${v.slice(0, 7)}…${v.slice(-4)}`;
}
