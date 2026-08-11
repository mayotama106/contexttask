import type { Task } from "../../lib/types";

/**
 * One Obsidian note per task. The frontmatter is what makes these queryable
 * from Dataview; the checklist line is what makes them readable as a note.
 */

/** Marks notes this app owns, so a reconcile never deletes a hand-written one. */
export const APP_MARKER = "contexttask";

/** Filesystem- and Obsidian-safe note name, collision-free via the task id. */
export function noteName(task: Task): string {
  const slug = task.title
    // Illegal on disk, or meaningful to Obsidian's link syntax.
    .replace(/[\\/:*?"<>|#^[\]]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
  return `${slug || "untitled"}-${task.id.slice(-6)}.md`;
}

function yaml(value: string): string {
  return JSON.stringify(value);
}

export function renderNote(task: Task): string {
  const iso = (ms: number) => new Date(ms).toISOString();
  const lines = [
    "---",
    `app: ${APP_MARKER}`,
    `id: ${task.id}`,
    `tags: [${task.tag}]`,
    `estimate: ${yaml(task.est)}`,
    task.due ? `due: ${yaml(task.due)}` : null,
    task.dueAt != null ? `due_date: ${new Date(task.dueAt).toISOString().slice(0, 10)}` : null,
    `done: ${String(task.done)}`,
    `important: ${String(task.important)}`,
    `tag_source: ${task.tagSource}`,
    `ai_status: ${task.aiStatus}`,
    `created: ${iso(task.createdAt)}`,
    `updated: ${iso(task.updatedAt)}`,
    "---",
    "",
    `- [${task.done ? "x" : " "}] ${task.title} #${task.tag}`,
    "",
    "> [!note] capture",
    `> ${task.raw}`,
    "",
  ];
  return lines.filter((line) => line !== null).join("\n");
}

/** True when the note carries our marker — the only ones a reconcile may delete. */
export function isOurNote(content: string): boolean {
  return content.startsWith("---") && content.slice(0, 200).includes(`app: ${APP_MARKER}`);
}
