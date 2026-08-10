import Dexie, { type Table } from "dexie";
import type { AiJob, Task } from "./types";

/**
 * Local-first store. Every capture lands here synchronously from the UI's point
 * of view: the React state is updated first and the write is fire-and-forget, so
 * nothing in the input path ever awaits IndexedDB (or the network).
 */
class ContextTaskDB extends Dexie {
  tasks!: Table<Task, string>;
  aiJobs!: Table<AiJob, string>;
  meta!: Table<{ key: string; value: unknown }, string>;

  constructor() {
    super("contexttask");
    this.version(1).stores({
      tasks: "id, createdAt, done, tag, aiStatus",
      aiJobs: "id, taskId, createdAt",
      meta: "key",
    });
  }
}

export const db = new ContextTaskDB();

export async function loadTasks(): Promise<Task[]> {
  const rows = await db.tasks.orderBy("createdAt").reverse().toArray();
  return rows;
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const row = await db.meta.get(key);
  return row?.value as T | undefined;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value });
}

/** Writes that must not block the UI thread's render path. */
export function writeThrough(op: () => Promise<unknown>): void {
  void op().catch((err) => {
    console.error("[db] write failed", err);
  });
}
