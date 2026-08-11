import { create } from "zustand";
import { db, loadTasks, writeThrough } from "../../lib/db";
import { parseCapture } from "../../lib/parse";
import { resolveDue } from "../../lib/due";
import type { AiJob, Task } from "../../lib/types";
import { HeuristicTagger, isAbort, type Tagger } from "../capture/aiTagger";
import { PermanentTaggerError } from "../capture/claudeTagger";
import { logActivity } from "../activity/store";
import { mergeTasks, type MergeResult } from "../../lib/backup";

const SEED: Array<Omit<Task, "createdAt" | "updatedAt">> = [
  { id: "s1", title: "週次レビューの資料を作る", raw: "週次レビューの資料を作る #work ~30m !今日", tag: "work", est: "30m", done: false, important: true, tagSource: "ai", aiStatus: "done" },
  { id: "s2", title: "Obsidian vault の同期設定を確認", raw: "Obsidian vault の同期設定を確認 #deep-focus ~15m", tag: "deep-focus", est: "15m", done: false, important: false, tagSource: "ai", aiStatus: "done" },
  { id: "s3", title: "AIタグ付けのプロンプトを調整", raw: "AIタグ付けのプロンプトを調整 #work ~45m", tag: "work", est: "45m", done: false, important: false, tagSource: "ai", aiStatus: "done" },
  { id: "s4", title: "四半期の振り返りを書く", raw: "四半期の振り返りを書く #waiting-on ~20m", tag: "waiting-on", est: "20m", done: true, important: false, tagSource: "ai", aiStatus: "done" },
];

interface TaskState {
  tasks: Task[];
  hydrated: boolean;
  /** Id of the task the toast's UNDO would remove, or null. */
  undoableId: string | null;
  /** When off, captures still save instantly — they just queue without inference. */
  aiEnabled: boolean;
  /** Non-null when the local DB could not be opened; the app runs memory-only. */
  storageError: string | null;
  hydrate: () => Promise<void>;
  capture: (raw: string) => Task | null;
  toggle: (id: string) => void;
  undo: (id: string) => void;
  applyInference: (id: string, patch: Partial<Task>) => void;
  setAiEnabled: (enabled: boolean) => void;
  /** User-driven edit of title/tag/estimate. Pins the tag so AI won't override. */
  editTask: (id: string, patch: EditableFields) => void;
  /** Permanent delete, unlike `undo` which only pops the just-captured task. */
  removeTask: (id: string) => void;
  /** Non-destructive restore from a backup file. */
  importTasks: (incoming: Task[]) => MergeResult;
  /** Wipes every task and suppresses the demo seed from coming back. */
  clearAll: () => void;
}

export interface EditableFields {
  title: string;
  tag: string;
  est: string;
  due: string;
  important: boolean;
}

let tagger: Tagger = new HeuristicTagger();
export function setTagger(next: Tagger): void {
  tagger = next;
}

/** Listeners the sync connector subscribes to; keeps the store free of sync deps. */
type Listener = (tasks: Task[]) => void;
const listeners = new Set<Listener>();
export function onTasksChanged(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function emit(tasks: Task[]): void {
  for (const fn of listeners) fn(tasks);
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  hydrated: false,
  undoableId: null,
  aiEnabled: true,
  storageError: null,

  hydrate: async () => {
    // The app must render even if IndexedDB is unavailable (private mode, an
    // evicted store, a WebView that blocks it). Falling back to memory-only
    // beats a permanently blank screen.
    try {
      let tasks = await loadTasks();
      if (tasks.length === 0 && (await db.meta.get("seeded")) === undefined) {
        const now = Date.now();
        tasks = SEED.map((t, i) => ({ ...t, createdAt: now - i * 1000, updatedAt: now - i * 1000 }));
        await db.tasks.bulkPut(tasks);
        await db.meta.put({ key: "seeded", value: true });
        tasks = await loadTasks();
      }
      set({ tasks, hydrated: true, storageError: null });
      emit(tasks);

      // Any job left over from a previous session (crash, offline) resumes here.
      const stale = await db.aiJobs.toArray();
      for (const job of stale) void runJob(job, set, get);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[store] hydrate failed, running memory-only", err);
      logActivity(`ローカルDBを開けません — メモリのみで動作中 (${message})`, "danger");
      set({ tasks: [], hydrated: true, storageError: message });
    }
  },

  capture: (raw) => {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const p = parseCapture(trimmed);
    const now = Date.now();
    const task: Task = {
      id: `t_${now}_${Math.random().toString(36).slice(2, 8)}`,
      title: p.title || trimmed,
      raw: trimmed,
      tag: p.tag ?? "inbox",
      est: p.est ?? "—",
      due: p.due,
      dueAt: resolveDue(p.due, now),
      done: false,
      important: p.important,
      createdAt: now,
      updatedAt: now,
      tagSource: p.tag ? "user" : "parse",
      // A user-supplied #tag is authoritative; otherwise the AI gets a turn.
      aiStatus: p.tag ? "done" : "pending",
    };

    // 1. UI first — this is what makes the save feel instant.
    const tasks = [task, ...get().tasks];
    set({ tasks, undoableId: task.id });

    // 2. Durable write, not awaited.
    writeThrough(() => db.tasks.put(task));
    emit(tasks);

    // 3. Background inference, entirely off the input path. The job is persisted
    //    either way, so turning inference back on drains whatever piled up.
    if (task.aiStatus === "pending") {
      const job: AiJob = { id: `j_${task.id}`, taskId: task.id, attempts: 0, createdAt: now };
      writeThrough(() => db.aiJobs.put(job));
      if (get().aiEnabled) void runJob(job, set, get);
    }
    return task;
  },

  toggle: (id) => {
    const tasks = get().tasks.map((t) =>
      t.id === id ? { ...t, done: !t.done, updatedAt: Date.now() } : t,
    );
    set({ tasks });
    const next = tasks.find((t) => t.id === id);
    if (next) writeThrough(() => db.tasks.put(next));
    emit(tasks);
  },

  undo: (id) => {
    const tasks = get().tasks.filter((t) => t.id !== id);
    set({ tasks, undoableId: null });
    writeThrough(async () => {
      await db.tasks.delete(id);
      await db.aiJobs.delete(`j_${id}`);
    });
    emit(tasks);
  },

  applyInference: (id, patch) => {
    const tasks = get().tasks.map((t) =>
      t.id === id ? { ...t, ...patch, updatedAt: Date.now() } : t,
    );
    set({ tasks });
    const next = tasks.find((t) => t.id === id);
    if (next) writeThrough(() => db.tasks.put(next));
    emit(tasks);
  },

  editTask: (id, patch) => {
    const title = patch.title.trim();
    if (!title) return;
    const tag = patch.tag.trim().replace(/^#/, "") || "inbox";
    const est = patch.est.trim().replace(/^~/, "") || "—";
    const due = patch.due.trim().replace(/^!/, "");
    const now = Date.now();

    const tasks = get().tasks.map((t) =>
      t.id === id
        ? {
            ...t,
            title,
            tag,
            est,
            due: due || undefined,
            dueAt: resolveDue(due, now),
            important: patch.important,
            // An explicit edit outranks inference — stop the AI from reverting it.
            tagSource: "user" as const,
            aiStatus: "done" as const,
            updatedAt: now,
          }
        : t,
    );
    set({ tasks });
    const next = tasks.find((t) => t.id === id);
    if (next) writeThrough(() => db.tasks.put(next));
    // Any inference still in flight for this task would clobber the edit.
    abortJob(`j_${id}`);
    writeThrough(() => db.aiJobs.delete(`j_${id}`));
    emit(tasks);
  },

  removeTask: (id) => {
    const tasks = get().tasks.filter((t) => t.id !== id);
    set({ tasks, undoableId: get().undoableId === id ? null : get().undoableId });
    abortJob(`j_${id}`);
    writeThrough(async () => {
      await db.tasks.delete(id);
      await db.aiJobs.delete(`j_${id}`);
    });
    emit(tasks);
  },

  importTasks: (incoming) => {
    const result = mergeTasks(get().tasks, incoming);
    set({ tasks: result.merged, undoableId: null });
    writeThrough(async () => {
      await db.tasks.bulkPut(result.merged);
      // Imported tasks stand on their own; do not re-run inference over them.
      await db.meta.put({ key: "seeded", value: true });
    });
    logActivity(`バックアップから ${result.added} 件を復元`, "success");
    emit(result.merged);
    return result;
  },

  clearAll: () => {
    for (const id of inflight.keys()) abortJob(id);
    set({ tasks: [], undoableId: null });
    writeThrough(async () => {
      await db.tasks.clear();
      await db.aiJobs.clear();
      // Without this the demo seed would reappear on the next launch.
      await db.meta.put({ key: "seeded", value: true });
    });
    logActivity("すべてのタスクを削除", "danger");
    emit([]);
  },

  setAiEnabled: (enabled) => {
    set({ aiEnabled: enabled });
    if (!enabled) {
      for (const id of [...inflight.keys()]) abortJob(id);
      logActivity("バックグラウンド解析を停止", "neutral");
      return;
    }
    logActivity("バックグラウンド解析を再開", "neutral");
    void db.aiJobs.toArray().then((jobs) => {
      for (const job of jobs) void runJob(job, set, get);
    });
  },
}));

const MAX_ATTEMPTS = 3;
const inflight = new Map<string, AbortController>();

/** Cancels an in-flight inference so it cannot overwrite a user's own change. */
function abortJob(jobId: string): void {
  inflight.get(jobId)?.abort();
  inflight.delete(jobId);
}

async function runJob(
  job: AiJob,
  set: (partial: Partial<TaskState>) => void,
  get: () => TaskState,
): Promise<void> {
  if (inflight.has(job.id) || !get().aiEnabled) return;
  const task = get().tasks.find((t) => t.id === job.taskId);
  if (!task) {
    writeThrough(() => db.aiJobs.delete(job.id));
    return;
  }
  const controller = new AbortController();
  inflight.set(job.id, controller);
  get().applyInference(task.id, { aiStatus: "processing" });

  try {
    const result = await tagger.infer(task, controller.signal);
    // The task may have been undone while the inference was in flight.
    if (!get().tasks.some((t) => t.id === task.id)) return;
    get().applyInference(task.id, {
      tag: result.tag,
      est: result.est ?? task.est,
      tagSource: "ai",
      aiStatus: "done",
    });
    logActivity(`「${task.title}」に #${result.tag} を付与`, "brand");
    writeThrough(() => db.aiJobs.delete(job.id));
  } catch (err) {
    if (isAbort(err)) {
      // Paused or undone — leave the job queued and the task re-runnable.
      if (get().tasks.some((t) => t.id === task.id)) {
        get().applyInference(task.id, { aiStatus: "pending" });
      }
      return;
    }

    // A rejected key or a refused request will fail identically every time;
    // retrying would burn the whole budget on each captured task.
    if (err instanceof PermanentTaggerError) {
      get().applyInference(task.id, { aiStatus: "error" });
      logActivity(err.message, "danger");
      writeThrough(() => db.aiJobs.delete(job.id));
      return;
    }

    const attempts = job.attempts + 1;
    if (attempts >= MAX_ATTEMPTS) {
      get().applyInference(task.id, { aiStatus: "error" });
      logActivity(`「${task.title}」の文脈解析に失敗`, "danger");
      writeThrough(() => db.aiJobs.delete(job.id));
      return;
    }
    const retry: AiJob = { ...job, attempts };
    writeThrough(() => db.aiJobs.put(retry));
    get().applyInference(task.id, { aiStatus: "pending" });
    setTimeout(() => void runJob(retry, set, get), 800 * 2 ** attempts);
  } finally {
    inflight.delete(job.id);
  }
}
