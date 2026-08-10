import { create } from "zustand";

export interface ActivityEntry {
  id: string;
  at: number;
  text: string;
  tone: "brand" | "neutral" | "success" | "danger";
}

const LIMIT = 30;

interface ActivityState {
  entries: ActivityEntry[];
  log: (text: string, tone?: ActivityEntry["tone"]) => void;
}

/** In-memory feed of background work — what the desktop "AI アクティビティ" panel shows. */
export const useActivityStore = create<ActivityState>((set) => ({
  entries: [],
  log: (text, tone = "neutral") =>
    set((s) => ({
      entries: [
        { id: `a_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, at: Date.now(), text, tone },
        ...s.entries,
      ].slice(0, LIMIT),
    })),
}));

export function logActivity(text: string, tone?: ActivityEntry["tone"]): void {
  useActivityStore.getState().log(text, tone);
}
