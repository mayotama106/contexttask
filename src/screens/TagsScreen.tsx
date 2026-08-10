import { useMemo, useState } from "react";
import { Card, Tag } from "../components/ds";
import { TaskLine } from "../features/tasks/TaskLine";
import { useTaskStore } from "../features/tasks/store";
import type { Task } from "../lib/types";
import "./list-screen.css";

/** Tag index: distribution first, then the tasks for whichever tag is selected. */
export function TagsScreen({ onOpen }: { onOpen: (task: Task) => void }) {
  const tasks = useTaskStore((s) => s.tasks);
  const toggle = useTaskStore((s) => s.toggle);
  const [selected, setSelected] = useState<string | null>(null);

  const dist = useMemo(() => {
    const counts = new Map<string, { total: number; open: number }>();
    for (const t of tasks) {
      const entry = counts.get(t.tag) ?? { total: 0, open: 0 };
      entry.total += 1;
      if (!t.done) entry.open += 1;
      counts.set(t.tag, entry);
    }
    const max = Math.max(1, ...[...counts.values()].map((c) => c.total));
    return [...counts.entries()]
      .map(([tag, c]) => ({ tag, ...c, pct: Math.round((c.total / max) * 100) }))
      .sort((a, b) => b.total - a.total || a.tag.localeCompare(b.tag));
  }, [tasks]);

  const listed = useMemo(
    () => (selected ? tasks.filter((t) => t.tag === selected) : []),
    [tasks, selected],
  );

  return (
    <div className="list-screen">
      <h1 className="list-screen__hero">TAGS</h1>
      <div className="list-screen__subline">{dist.length} TAGS</div>

      {dist.length === 0 ? (
        <Card style={{ padding: "24px 16px" }}>
          <p className="list-screen__empty">まだタスクがありません。</p>
        </Card>
      ) : (
        <Card style={{ padding: 14 }}>
          <div className="tags__list">
            {dist.map((d) => (
              <button
                key={d.tag}
                type="button"
                className={selected === d.tag ? "tags__row tags__row--active" : "tags__row"}
                onClick={() => setSelected(selected === d.tag ? null : d.tag)}
                aria-pressed={selected === d.tag}
              >
                <div className="tags__head">
                  <Tag active={selected === d.tag}>{d.tag}</Tag>
                  <span className="tags__count">
                    {d.open} / {d.total}
                  </span>
                </div>
                <div className="tags__track">
                  <div className="tags__fill" style={{ width: `${String(d.pct)}%` }} />
                </div>
              </button>
            ))}
          </div>
        </Card>
      )}

      {selected && (
        <section className="list-screen__section">
          <div className="list-screen__label">
            #{selected} · {listed.length}
          </div>
          <Card style={{ padding: "4px 14px 8px" }}>
            {listed.map((task) => (
              <TaskLine key={task.id} task={task} onToggle={toggle} onOpen={onOpen} />
            ))}
          </Card>
        </section>
      )}
    </div>
  );
}
