import { useMemo } from "react";
import { Card } from "../components/ds";
import { TaskLine } from "../features/tasks/TaskLine";
import { useTaskStore } from "../features/tasks/store";
import { isOverdue, startOfDay } from "../lib/due";
import type { Task } from "../lib/types";
import "./list-screen.css";

/**
 * What actually needs doing today: anything overdue, due today, or flagged
 * important. Grouped so an overdue item can never hide below the fold.
 */
export function TodayScreen({ now, onOpen }: { now: number; onOpen: (task: Task) => void }) {
  const tasks = useTaskStore((s) => s.tasks);
  const toggle = useTaskStore((s) => s.toggle);

  const groups = useMemo(() => {
    const today = startOfDay(now);
    const open = tasks.filter((t) => !t.done);
    return [
      {
        key: "overdue",
        label: "超過",
        tone: "danger" as const,
        items: open.filter((t) => isOverdue(t.dueAt, now)),
      },
      {
        key: "today",
        label: "今日",
        tone: "normal" as const,
        items: open.filter((t) => t.dueAt === today),
      },
      {
        key: "important",
        label: "重要 · 日付なし",
        tone: "normal" as const,
        // Only undated ones. Capture flags every `!due` task as important
        // (handoff rule), so including dated tasks here would drag the whole
        // future onto a screen that is supposed to be about today.
        items: open.filter((t) => t.important && t.dueAt == null),
      },
    ].filter((g) => g.items.length > 0);
  }, [tasks, now]);

  const total = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <div className="list-screen">
      <h1 className="list-screen__hero">TODAY</h1>
      <div className="list-screen__subline">{total} DUE</div>

      {groups.length === 0 ? (
        <Card style={{ padding: "24px 16px" }}>
          <p className="list-screen__empty">
            今日やるべきものはありません。
            <br />
            期限は <code>!今日</code> <code>!明日</code> <code>!金曜</code> <code>!8/14</code>{" "}
            のように書けます。
          </p>
        </Card>
      ) : (
        groups.map((group) => (
          <section key={group.key} className="list-screen__section">
            <div
              className={
                group.tone === "danger"
                  ? "list-screen__label list-screen__label--danger"
                  : "list-screen__label"
              }
            >
              {group.label} · {group.items.length}
            </div>
            <Card style={{ padding: "4px 14px 8px" }}>
              {group.items.map((task) => (
                <TaskLine key={task.id} task={task} onToggle={toggle} onOpen={onOpen} />
              ))}
            </Card>
          </section>
        ))
      )}
    </div>
  );
}
