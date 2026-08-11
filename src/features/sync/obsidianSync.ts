import { create } from "zustand";
import { getMeta, setMeta } from "../../lib/db";
import type { SyncStatus, Task } from "../../lib/types";
import { onTasksChanged } from "../tasks/store";
import { logActivity } from "../activity/store";

/**
 * A destination that tasks are mirrored to. No adapter is wired right now: the
 * app is local-first and the phone build has no filesystem access to a vault.
 * Implement this and pass it to `startObsidianSync` to connect one — the UI only
 * observes `useSyncStore`, so nothing else has to change.
 */
export interface VaultAdapter {
  push(tasks: Task[]): Promise<void>;
}

interface SyncStore extends SyncStatus {
  set: (patch: Partial<SyncStatus>) => void;
}

export const useSyncStore = create<SyncStore>((set) => ({
  // No vault is connected, so the honest resting state is "local only".
  state: "disconnected",
  lastSyncedAt: null,
  pending: 0,
  set: (patch) => set(patch),
}));

const DEBOUNCE_MS = 1200;

/**
 * Starts the connector: coalesces bursts of edits, never blocks a capture, and
 * reflects offline/error states rather than retrying silently forever.
 */
/**
 * The live adapter, swapped at runtime when the user connects or disconnects a
 * vault in settings — the connector itself keeps running either way.
 */
let activeAdapter: VaultAdapter | null = null;
let onAdapterChange: ((adapter: VaultAdapter | null) => void) | null = null;

export function setVaultAdapter(adapter: VaultAdapter | null): void {
  activeAdapter = adapter;
  onAdapterChange?.(adapter);
}

export function startObsidianSync(adapter?: VaultAdapter): () => void {
  const store = useSyncStore.getState();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let queued: Task[] | null = null;
  let running = false;

  if (adapter) activeAdapter = adapter;
  onAdapterChange = (next) => {
    if (!next) {
      store.set({ state: "disconnected", pending: 0, lastSyncedAt: null });
      return;
    }
    // Push everything the moment a vault is connected.
    store.set({ state: "syncing" });
    schedule();
  };

  void getMeta<number>("lastSyncedAt").then((ts) => {
    if (ts) store.set({ lastSyncedAt: ts });
  });

  const flush = async () => {
    if (running || !queued) return;
    if (!activeAdapter) {
      store.set({ state: "disconnected", pending: 0 });
      return;
    }
    if (!navigator.onLine) {
      store.set({ state: "offline" });
      return;
    }
    const batch = queued;
    queued = null;
    running = true;
    store.set({ state: "syncing" });
    try {
      await activeAdapter.push(batch);
      const now = Date.now();
      await setMeta("lastSyncedAt", now);
      store.set({ state: "synced", lastSyncedAt: now, pending: 0, error: undefined });
      logActivity(`Vault へ ${batch.length} 件を同期`, "success");
    } catch (err) {
      queued = batch;
      logActivity(
        err instanceof Error ? `Vault 同期に失敗: ${err.message}` : "Vault 同期に失敗",
        "danger",
      );
      store.set({
        state: navigator.onLine ? "error" : "offline",
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      running = false;
      if (queued) schedule();
    }
  };

  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(() => void flush(), DEBOUNCE_MS);
  };

  const unsubscribe = onTasksChanged((tasks) => {
    queued = tasks;
    if (!activeAdapter) {
      store.set({ state: "disconnected" });
      return;
    }
    store.set({ pending: useSyncStore.getState().pending + 1 });
    schedule();
  });

  const online = () => {
    if (queued) schedule();
    else store.set({ state: "synced" });
  };
  const offline = () => store.set({ state: "offline" });
  window.addEventListener("online", online);
  window.addEventListener("offline", offline);

  return () => {
    clearTimeout(timer);
    onAdapterChange = null;
    unsubscribe();
    window.removeEventListener("online", online);
    window.removeEventListener("offline", offline);
  };
}

export function formatRelative(ts: number | null, now = Date.now()): string {
  if (!ts) return "未同期";
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 10) return "たった今";
  if (s < 60) return `${s}秒前`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}分前`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}時間前`;
  return `${Math.round(h / 24)}日前`;
}

export function syncLabel(status: SyncStatus, now = Date.now()): string {
  switch (status.state) {
    case "syncing":
      return "Obsidian 同期中…";
    case "error":
      return "Obsidian 同期エラー";
    case "offline":
      return "オフライン · ローカルに保存済み";
    case "disconnected":
      return "Vault 未接続 · ローカルに保存済み";
    default:
      return status.lastSyncedAt === null
        ? "Obsidian 同期待ち"
        : `Obsidian 同期済み · ${formatRelative(status.lastSyncedAt, now)}`;
  }
}

export function syncDotColor(state: SyncStatus["state"]): string {
  switch (state) {
    case "syncing":
      return "var(--ice-400)";
    case "error":
      return "var(--red-500)";
    case "offline":
      return "var(--gold-500)";
    case "disconnected":
      return "var(--mist-600)";
    default:
      return "var(--green-500)";
  }
}
