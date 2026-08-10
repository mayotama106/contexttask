export type AiStatus = "pending" | "processing" | "done" | "error";

export interface Task {
  id: string;
  /** Title with #tag / ~est / !due tokens stripped out. */
  title: string;
  /** Raw text exactly as captured, kept for AI re-inference and Obsidian round-trip. */
  raw: string;
  tag: string;
  est: string;
  /** The token the user typed, e.g. "明日" or "8/14". Kept verbatim. */
  due?: string;
  /** `due` resolved to a start-of-day timestamp, or null if unparseable. */
  dueAt?: number | null;
  done: boolean;
  important: boolean;
  createdAt: number;
  updatedAt: number;
  /** Where the current tag came from — the AI may overwrite a locally parsed one. */
  tagSource: "user" | "parse" | "ai";
  aiStatus: AiStatus;
}

export interface AiJob {
  id: string;
  taskId: string;
  attempts: number;
  createdAt: number;
}

export type SyncState = "synced" | "syncing" | "error" | "offline" | "disconnected";

export interface SyncStatus {
  state: SyncState;
  lastSyncedAt: number | null;
  pending: number;
  error?: string;
}

/** Result of live-parsing the capture input. */
export interface ParsedCapture {
  title: string;
  tag?: string;
  est?: string;
  due?: string;
}
