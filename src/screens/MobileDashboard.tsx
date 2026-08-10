import { useMemo, useState } from "react";
import { BookOpen, LayoutDashboard, Settings, Sun, Tag as TagIcon } from "lucide-react";
import { Card, Tabs, Toast } from "../components/ds";
import { CaptureDock } from "../features/capture/CaptureDock";
import { TaskLine } from "../features/tasks/TaskLine";
import { TaskEditor } from "../features/tasks/TaskEditor";
import { useTaskStore } from "../features/tasks/store";
import { SettingsScreen } from "./SettingsScreen";
import { TodayScreen } from "./TodayScreen";
import { TagsScreen } from "./TagsScreen";
import type { Task } from "../lib/types";
import { syncDotColor, syncLabel, useSyncStore } from "../features/sync/obsidianSync";
import { useClock } from "../lib/useClock";
import "./mobile.css";

const TABS = [
  { id: "home", label: "ホーム", Icon: LayoutDashboard },
  { id: "today", label: "今日", Icon: Sun },
  { id: "tags", label: "タグ", Icon: TagIcon },
  { id: "settings", label: "設定", Icon: Settings },
] as const;

const LIST_TABS = [
  { value: "focus", label: "フォーカス" },
  { value: "all", label: "すべて" },
] as const;

type ListTab = (typeof LIST_TABS)[number]["value"];

const TOAST_MS = 2600;

export function MobileDashboard() {
  const now = useClock(30_000);
  const tasks = useTaskStore((s) => s.tasks);
  const capture = useTaskStore((s) => s.capture);
  const toggle = useTaskStore((s) => s.toggle);
  const undo = useTaskStore((s) => s.undo);
  const editTask = useTaskStore((s) => s.editTask);
  const removeTask = useTaskStore((s) => s.removeTask);
  const sync = useSyncStore();

  const [navTab, setNavTab] = useState<(typeof TABS)[number]["id"]>("home");
  const [listTab, setListTab] = useState<ListTab>("focus");
  const [toast, setToast] = useState<{ message: string; undoId: string } | null>(null);
  const [editing, setEditing] = useState<Task | null>(null);

  const open = useMemo(() => tasks.filter((t) => !t.done), [tasks]);
  const startOfDay = new Date(now).setHours(0, 0, 0, 0);
  const visible = useMemo(
    () =>
      listTab === "all"
        ? tasks
        : tasks.filter((t) => !t.done || t.updatedAt >= startOfDay),
    [tasks, listTab, startOfDay],
  );

  const onCapture = (raw: string) => {
    const task = capture(raw);
    if (!task) return;
    setToast({ message: "保存しました — AI が文脈を解析中", undoId: task.id });
    window.setTimeout(() => {
      setToast((current) => (current?.undoId === task.id ? null : current));
    }, TOAST_MS);
  };

  const dateLabel = new Date(now)
    .toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" })
    .replace(/\//g, ".");

  return (
    <div className="mobile">
      {/* The handoff's 44px status bar is drawn by iOS itself in the native
          shell, so this is only the safe-area inset it used to occupy. */}
      <div className="mobile__statusbar" aria-hidden />

      <div className="mobile__content">
        {navTab === "settings" ? (
          <SettingsScreen />
        ) : navTab === "today" ? (
          <TodayScreen now={now} onOpen={setEditing} />
        ) : navTab === "tags" ? (
          <TagsScreen onOpen={setEditing} />
        ) : (
          <>
            <div>
              <h1 className="mobile__hero">TODAY</h1>
              <div className="mobile__subline">
                {dateLabel} · {open.length} OPEN
              </div>
              <div className="mobile__sync">
                <span
                  className="mobile__sync-dot"
                  style={{ background: syncDotColor(sync.state) }}
                  aria-hidden
                />
                <BookOpen size={12} style={{ color: "var(--text-tertiary)" }} />
                <span className="mobile__sync-label">{syncLabel(sync, now)}</span>
              </div>
            </div>

            <Tabs items={LIST_TABS} value={listTab} onChange={setListTab} />

            <Card style={{ padding: "4px 14px 8px" }}>
              {visible.length === 0 ? (
                <div className="mobile__empty">下のバーから最初のタスクを入力</div>
              ) : (
                visible.map((task) => (
                  <TaskLine key={task.id} task={task} onToggle={toggle} onOpen={setEditing} />
                ))
              )}
            </Card>

            <span
              className="motif-cross"
              style={{ right: 26, bottom: 40, color: "var(--gold-500)", opacity: 0.35 }}
            >
              ✕
            </span>
          </>
        )}
      </div>

      {toast && (
        <div className="mobile__toast">
          <Toast tone="success" style={{ fontSize: 12, width: "100%", justifyContent: "space-between" }}>
            {toast.message}
            <button
              type="button"
              className="mobile__undo ds-hit"
              onClick={() => {
                undo(toast.undoId);
                setToast(null);
              }}
            >
              UNDO
            </button>
          </Toast>
        </div>
      )}

      {editing && (
        <TaskEditor
          // Re-read from the store so an AI tag landing mid-edit is not stale.
          task={tasks.find((t) => t.id === editing.id) ?? editing}
          onSave={editTask}
          onDelete={removeTask}
          onClose={() => setEditing(null)}
        />
      )}

      <CaptureDock onSubmit={onCapture} />

      <nav className="mobile__tabbar">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            className="ds-tabbar-item"
            aria-current={navTab === id ? "page" : undefined}
            onClick={() => setNavTab(id)}
            style={{ color: navTab === id ? "var(--ice-500)" : "var(--text-tertiary)" }}
          >
            <Icon size={19} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
