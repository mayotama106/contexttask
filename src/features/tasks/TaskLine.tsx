import { Badge, Checkbox, Tag } from "../../components/ds";
import type { Task } from "../../lib/types";
import "./task-line.css";

/**
 * One row of the focus list. `compact` matches the desktop's 10px row padding;
 * mobile uses 12px and a 44px minimum so the whole row is a comfortable target.
 */
export function TaskLine({
  task,
  onToggle,
  compact,
}: {
  task: Task;
  onToggle: (id: string) => void;
  compact?: boolean;
}) {
  // Ice is reserved for focus/active/AI-processing: an unresolved tag glows
  // until the background inference lands, with no spinner anywhere.
  const inferring = task.aiStatus === "pending" || task.aiStatus === "processing";

  return (
    <div className={compact ? "task-line task-line--compact" : "task-line"}>
      <Checkbox
        checked={task.done}
        onChange={() => onToggle(task.id)}
        label={`${task.title} を${task.done ? "未完了" : "完了"}にする`}
      />
      <div className="task-line__body" style={{ opacity: task.done ? 0.45 : 1 }}>
        <div
          className="task-line__title"
          style={{ textDecoration: task.done ? "line-through" : "none" }}
        >
          {task.title}
        </div>
        <div className="task-line__meta">
          <Tag active={inferring}>{task.tag}</Tag>
          <Badge tone="neutral">~{task.est}</Badge>
        </div>
      </div>
      {task.important && !task.done && <Badge tone="accent">重要</Badge>}
    </div>
  );
}
