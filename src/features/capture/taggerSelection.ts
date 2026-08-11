import { create } from "zustand";
import { clearApiKey, loadApiKey, maskApiKey, saveApiKey } from "../../lib/apiKey";
import { logActivity } from "../activity/store";
import { setTagger } from "../tasks/store";
import { HeuristicTagger } from "./aiTagger";
import { ClaudeTagger, type TaggerUsage } from "./claudeTagger";

/**
 * Decides which tagger is live. With a key stored, captures are classified by
 * Claude; without one, the local heuristic keeps working — the app is never
 * blocked on having an API key.
 */
interface TaggerState {
  /** Masked for display; the full key is never held in React state. */
  maskedKey: string | null;
  usingClaude: boolean;
  /** Running total for this session, so the cost is visible while trying it out. */
  inputTokens: number;
  outputTokens: number;
  calls: number;
  load: () => Promise<void>;
  setKey: (key: string) => Promise<void>;
  removeKey: () => Promise<void>;
}

export const useTaggerStore = create<TaggerState>((set, get) => ({
  maskedKey: null,
  usingClaude: false,
  inputTokens: 0,
  outputTokens: 0,
  calls: 0,

  load: async () => {
    const key = await loadApiKey();
    apply(key, set, get);
  },

  setKey: async (key) => {
    await saveApiKey(key);
    apply(key.trim(), set, get);
    logActivity("Claude によるタグ付けを有効化", "success");
  },

  removeKey: async () => {
    await clearApiKey();
    apply(null, set, get);
    logActivity("Claude のキーを削除。ローカル推定に戻りました", "neutral");
  },
}));

function apply(
  key: string | null,
  set: (partial: Partial<TaggerState>) => void,
  get: () => TaggerState,
): void {
  if (!key) {
    setTagger(new HeuristicTagger());
    set({ maskedKey: null, usingClaude: false });
    return;
  }

  const onUsage = ({ inputTokens, outputTokens }: TaggerUsage) => {
    const s = get();
    set({
      inputTokens: s.inputTokens + inputTokens,
      outputTokens: s.outputTokens + outputTokens,
      calls: s.calls + 1,
    });
  };

  setTagger(new ClaudeTagger(key, onUsage));
  set({ maskedKey: maskApiKey(key), usingClaude: true });
}

/** Haiku 4.5 list price, for the running estimate shown in settings. */
const INPUT_PER_MTOK = 1.0;
const OUTPUT_PER_MTOK = 5.0;

export function estimateCostUsd(inputTokens: number, outputTokens: number): number {
  return (inputTokens / 1_000_000) * INPUT_PER_MTOK + (outputTokens / 1_000_000) * OUTPUT_PER_MTOK;
}
