import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Badge, Button, Field, Input, Sheet } from "../../components/ds";
import { VOCABULARY } from "../capture/aiTagger";
import type { Task } from "../../lib/types";
import type { EditableFields } from "./store";
import "./task-editor.css";

/**
 * Edit or delete a single task. Deletion is behind a confirm step because it is
 * the one irreversible action in the app — the toast UNDO only covers a capture.
 */
export function TaskEditor({
  task,
  onSave,
  onDelete,
  onClose,
}: {
  task: Task;
  onSave: (id: string, patch: EditableFields) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [tag, setTag] = useState(task.tag);
  const [est, setEst] = useState(task.est === "—" ? "" : task.est);
  const [important, setImportant] = useState(task.important);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const save = () => {
    if (!title.trim()) return;
    onSave(task.id, { title, tag, est, important });
    onClose();
  };

  return (
    <Sheet title="タスクを編集" onClose={onClose}>
      <Field label="Title">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
          }}
          aria-label="タイトル"
          autoFocus
          style={{ height: 46 }}
        />
      </Field>

      <Field label="Tag">
        <Input
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          placeholder="inbox"
          aria-label="タグ"
          autoCapitalize="off"
          autoCorrect="off"
          style={{ height: 46 }}
        />
      </Field>
      <div className="task-editor__vocab">
        {VOCABULARY.map((v) => (
          <button key={v} type="button" className="ds-chip ds-hit" onClick={() => setTag(v)}>
            #{v}
          </button>
        ))}
      </div>

      <Field label="Estimate">
        <Input
          value={est}
          onChange={(e) => setEst(e.target.value)}
          placeholder="30m"
          aria-label="見積もり"
          autoCapitalize="off"
          autoCorrect="off"
          style={{ height: 46 }}
        />
      </Field>

      <button
        type="button"
        className="task-editor__toggle"
        aria-pressed={important}
        onClick={() => setImportant((v) => !v)}
      >
        {important ? <Badge tone="accent">重要</Badge> : <Badge tone="neutral">重要でない</Badge>}
        <span className="task-editor__toggle-hint">タップで切り替え</span>
      </button>

      <div className="task-editor__actions">
        {confirmingDelete ? (
          <>
            <Button variant="ghost" onClick={() => setConfirmingDelete(false)}>
              やめる
            </Button>
            <button
              type="button"
              className="task-editor__danger"
              onClick={() => {
                onDelete(task.id);
                onClose();
              }}
            >
              完全に削除する
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="task-editor__delete ds-hit"
              aria-label="削除"
              onClick={() => setConfirmingDelete(true)}
            >
              <Trash2 size={16} />
            </button>
            <Button variant="accent" onClick={save} disabled={!title.trim()}>
              保存
            </Button>
          </>
        )}
      </div>
    </Sheet>
  );
}
