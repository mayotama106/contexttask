import { useMemo } from "react";
import { Card } from "../components/ds";
import { TaskLine } from "../features/tasks/TaskLine";
import { useTaskStore } from "../features/tasks/store";
import { dueLabel, startOfDay } from "../lib/due";
import type { Task } from "../lib/types";
import "./list-screen.css";

/** Everything dated after today, grouped by day and ordered soonest first. */
export function UpcomingScreen({ now, onOpen }: { now: number; onOpen: (task: Task) => void }) {
  const tasks = useTaskStore((s) => s.tasks);
  const toggle = useTaskStore((s) => s.toggle);

  const days = useMemo(() => {
    const today = startOfDay(now);
    const byDay = new Map<number, Task[]>();
    for (const t of tasks) {
      if (t.done || t.dueAt == null || t.dueAt <= today) continue;
      const bucket = byDay.get(t.dueAt) ?? [];
      bucket.push(t);
      byDay.set(t.dueAt, bucket);
    }
    return [...byDay.entries()].sort((a, b) => a[0] - b[0]);
  }, [tasks, now]);

  const total = days.reduce((n, [, items]) => n + items.length, 0);

  return (
    <div className="list-screen">
      <h1 className="list-screen__hero">UPCOMING</h1>
      <div className="list-screen__subline">{total} SCHEDULED</div>

      {days.length === 0 ? (
        <Card style={{ padding: "24px 16px" }}>
          <p className="list-screen__empty">先の予定はありません。</p>
        </Card>
      ) : (
        days.map(([day, items]) => (
          <section key={day} className="list-screen__section">
            <div className="list-screen__label">
              {dueLabel(day, now)} ·{" "}
              {new Date(day).toLocaleDateString("ja-JP", {
                month: "2-digit",
                day: "2-digit",
                weekday: "short",
              })}
            </div>
            <Card style={{ padding: "4px 14px 8px" }}>
              {items.map((task) => (
                <TaskLine key={task.id} task={task} onToggle={toggle} onOpen={onOpen} />
              ))}
            </Card>
          </section>
        ))
      )}
    </div>
  );
}
