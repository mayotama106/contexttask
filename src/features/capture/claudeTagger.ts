import Anthropic from "@anthropic-ai/sdk";
import type { Task } from "../../lib/types";
import { VOCABULARY, type Inference, type Tagger, type Vocabulary } from "./aiTagger";

/**
 * Real tagging via the Claude API, called straight from the browser with the
 * user's own key (see lib/apiKey.ts for why that is safe here and what it costs).
 *
 * Haiku 4.5 — this is a short classification against a fixed vocabulary, which
 * is what the cheapest model is for. No thinking: `effort` errors on Haiku 4.5,
 * and a one-line classification has nothing to think about.
 */
const MODEL = "claude-haiku-4-5";
const MAX_TOKENS = 256;

const SYSTEM = `あなたはタスク管理アプリの分類器です。ユーザーが書き留めたタスク 1 件を読み、統制語彙からタグを 1 つ選び、所要時間を見積もります。

タグの意味:
- work: 仕事の実務。会議、資料、報告、案件対応
- deep-focus: まとまった集中を要する思考作業。設計、執筆、レビュー、振り返り
- waiting-on: 自分では進められず他者の応答を待つもの
- errand: 外出や手続きを伴う用事。買い物、支払い、予約、通院
- life: 私生活の維持。家事、運動、家族
- inbox: 上のどれにも自信を持って当てはめられないとき

判断は簡潔に。迷ったら inbox を選ぶこと。`;

/** Constrains the reply so no parsing heuristics are needed. */
const SCHEMA = {
  type: "object",
  properties: {
    tag: { type: "string", enum: [...VOCABULARY] },
    estimate_minutes: { type: "integer", enum: [5, 15, 30, 45, 60, 90, 120] },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
  },
  required: ["tag", "estimate_minutes", "confidence"],
  additionalProperties: false,
} as const;

interface Reply {
  tag: Vocabulary;
  estimate_minutes: number;
  confidence: "low" | "medium" | "high";
}

const CONFIDENCE: Record<Reply["confidence"], number> = { low: 0.3, medium: 0.65, high: 0.9 };

/** A failure that retrying cannot fix — a bad key, no credit, a rejected request. */
export class PermanentTaggerError extends Error {}

export interface TaggerUsage {
  inputTokens: number;
  outputTokens: number;
}

export class ClaudeTagger implements Tagger {
  private readonly client: Anthropic;

  constructor(
    apiKey: string,
    /** Called after each successful call so the UI can show what was spent. */
    private readonly onUsage?: (usage: TaggerUsage) => void,
  ) {
    this.client = new Anthropic({
      apiKey,
      // The key belongs to the person running the app and never leaves their
      // device except to Anthropic. See lib/apiKey.ts.
      dangerouslyAllowBrowser: true,
      // The job queue does its own backoff and abort handling.
      maxRetries: 0,
    });
  }

  async infer(task: Task, signal: AbortSignal): Promise<Inference> {
    let message;
    try {
      message = await this.client.messages.create(
        {
          model: MODEL,
          max_tokens: MAX_TOKENS,
          system: SYSTEM,
          output_config: { format: { type: "json_schema", schema: SCHEMA } },
          messages: [{ role: "user", content: task.raw || task.title }],
        },
        { signal },
      );
    } catch (err) {
      throw classify(err);
    }

    if (message.stop_reason === "refusal") {
      // Nothing to retry: the same input would be declined again.
      throw new PermanentTaggerError("この内容は分類できませんでした");
    }

    this.onUsage?.({
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
    });

    const text = message.content.find((b) => b.type === "text")?.text;
    if (!text) throw new Error("空の応答が返りました");

    let reply: Reply;
    try {
      reply = JSON.parse(text) as Reply;
    } catch {
      throw new Error("応答を JSON として読めませんでした");
    }
    if (!VOCABULARY.includes(reply.tag)) {
      throw new Error(`未知のタグ: ${String(reply.tag)}`);
    }

    return {
      tag: reply.tag,
      est: formatMinutes(reply.estimate_minutes),
      confidence: CONFIDENCE[reply.confidence] ?? 0.5,
    };
  }
}

function formatMinutes(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return "—";
  if (minutes >= 60 && minutes % 60 === 0) return `${String(minutes / 60)}h`;
  return `${String(minutes)}m`;
}

/**
 * Splits API failures into "retrying might help" and "retrying never will".
 * Without this a wrong key burns the queue's full retry budget on every task.
 */
function classify(err: unknown): Error {
  if (err instanceof Anthropic.AuthenticationError) {
    return new PermanentTaggerError("API キーが拒否されました。設定を確認してください");
  }
  if (err instanceof Anthropic.PermissionDeniedError) {
    return new PermanentTaggerError("このキーにはこのモデルへの権限がありません");
  }
  if (err instanceof Anthropic.BadRequestError) {
    return new PermanentTaggerError(`リクエストが拒否されました: ${err.message}`);
  }
  if (err instanceof Anthropic.RateLimitError) {
    return new Error("レート制限に達しました");
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return new Error("API に接続できませんでした");
  }
  return err instanceof Error ? err : new Error(String(err));
}
