import type { Task } from "../../lib/types";

/**
 * Controlled vocabulary the tagger is allowed to return. The AI never invents
 * a tag — it picks from this list, matching the product's "controlled
 * vocabulary" claim in the handoff.
 */
export const VOCABULARY = [
  "work",
  "life",
  "deep-focus",
  "waiting-on",
  "errand",
  "inbox",
] as const;

export type Vocabulary = (typeof VOCABULARY)[number];

export interface Inference {
  tag: Vocabulary;
  est?: string;
  confidence: number;
}

export interface Tagger {
  infer(task: Task, signal: AbortSignal): Promise<Inference>;
}

const KEYWORDS: Array<[Vocabulary, RegExp]> = [
  ["deep-focus", /(レビュー|設計|執筆|振り返り|集中|prompt|プロンプト|調整)/i],
  ["waiting-on", /(待ち|依頼|返信|確認待ち|承認)/i],
  ["errand", /(買|支払|予約|通院|受け取)/i],
  ["work", /(会議|資料|報告|案件|クライアント|meeting|deploy|リリース)/i],
  ["life", /(家|掃除|料理|運動|散歩|家族)/i],
];

/**
 * Local heuristic stand-in for the real model call. Swap this implementation
 * for a network-backed one — the queue below only depends on the `Tagger`
 * interface, and treats every inference as best-effort and interruptible.
 */
export class HeuristicTagger implements Tagger {
  constructor(private readonly latencyMs = 900) {}

  infer(task: Task, signal: AbortSignal): Promise<Inference> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const hit = KEYWORDS.find(([, re]) => re.test(task.raw));
        resolve({
          tag: hit ? hit[0] : "inbox",
          est: task.est === "—" ? estimateFor(task.raw) : undefined,
          confidence: hit ? 0.82 : 0.4,
        });
      }, this.latencyMs);
      signal.addEventListener("abort", () => {
        clearTimeout(timer);
        reject(new DOMException("aborted", "AbortError"));
      });
    });
  }
}

function estimateFor(raw: string): string {
  const len = raw.trim().length;
  if (len > 40) return "45m";
  if (len > 20) return "30m";
  return "15m";
}

export function isAbort(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}
