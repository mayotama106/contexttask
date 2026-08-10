import type { AiStatus, Task } from "./types";
import { resolveDue } from "./due";

/**
 * Export/import for the local task database. This is the only escape hatch the
 * data has: the app is local-first with no server, and iOS can evict the store.
 */

export const BACKUP_VERSION = 1;

export interface Backup {
  app: "contexttask";
  version: number;
  exportedAt: string;
  tasks: Task[];
}

export function buildBackup(tasks: Task[]): Backup {
  return {
    app: "contexttask",
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    tasks,
  };
}

export function backupFilename(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `contexttask-${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}.json`;
}

/** Triggers a file download of the current tasks. */
export function downloadBackup(tasks: Task[]): void {
  const blob = new Blob([JSON.stringify(buildBackup(tasks), null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = backupFilename();
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Safari needs the object URL to outlive the click.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export class BackupError extends Error {}

const AI_STATUSES: AiStatus[] = ["pending", "processing", "done", "error"];

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function bool(value: unknown): boolean {
  return value === true;
}

function time(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

/**
 * Parses a backup file. Every field is coerced rather than trusted — the file
 * comes from outside the app and a malformed one must not corrupt the store.
 */
export function parseBackup(text: string): Task[] {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupError("JSON として読めませんでした");
  }

  if (typeof raw !== "object" || raw === null) {
    throw new BackupError("バックアップの形式が違います");
  }
  const doc = raw as Partial<Backup>;
  if (doc.app !== "contexttask") {
    throw new BackupError("ContextTask のバックアップではありません");
  }
  if (typeof doc.version !== "number" || doc.version > BACKUP_VERSION) {
    throw new BackupError(`対応していないバージョンです (v${String(doc.version)})`);
  }
  if (!Array.isArray(doc.tasks)) {
    throw new BackupError("tasks が配列ではありません");
  }

  const now = Date.now();
  const seen = new Set<string>();
  const tasks: Task[] = [];

  for (const entry of doc.tasks) {
    if (typeof entry !== "object" || entry === null) continue;
    const t = entry as Partial<Task>;
    const title = str(t.title).trim();
    const id = str(t.id).trim();
    // A task with no id or no title carries no information worth restoring.
    if (!id || !title || seen.has(id)) continue;
    seen.add(id);

    const createdAt = time(t.createdAt, now);
    tasks.push({
      id,
      title,
      raw: str(t.raw, title),
      tag: str(t.tag, "inbox") || "inbox",
      est: str(t.est, "—") || "—",
      due: typeof t.due === "string" && t.due ? t.due : undefined,
      // Older backups predate dueAt; recover it from the token they do carry.
      dueAt:
        typeof t.dueAt === "number"
          ? t.dueAt
          : resolveDue(typeof t.due === "string" ? t.due : undefined, createdAt),
      done: bool(t.done),
      important: bool(t.important),
      createdAt,
      updatedAt: time(t.updatedAt, createdAt),
      tagSource: t.tagSource === "user" || t.tagSource === "ai" ? t.tagSource : "parse",
      // Never restore a task as mid-flight; the job queue is not in the backup.
      aiStatus: AI_STATUSES.includes(t.aiStatus as AiStatus) && t.aiStatus !== "processing"
        ? (t.aiStatus as AiStatus)
        : "done",
    });
  }

  if (tasks.length === 0) {
    throw new BackupError("復元できるタスクがありませんでした");
  }
  return tasks;
}

export interface MergeResult {
  merged: Task[];
  added: number;
  updated: number;
}

/**
 * Upserts by id, newest `updatedAt` wins. Import is non-destructive: restoring
 * into a populated app adds and refreshes, it never drops existing tasks.
 */
export function mergeTasks(current: Task[], incoming: Task[]): MergeResult {
  const byId = new Map(current.map((t) => [t.id, t]));
  let added = 0;
  let updated = 0;

  for (const task of incoming) {
    const existing = byId.get(task.id);
    if (!existing) {
      byId.set(task.id, task);
      added += 1;
    } else if (task.updatedAt > existing.updatedAt) {
      byId.set(task.id, task);
      updated += 1;
    }
  }

  const merged = [...byId.values()].sort((a, b) => b.createdAt - a.createdAt);
  return { merged, added, updated };
}
