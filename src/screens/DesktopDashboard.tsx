import { useMemo, useState, type ReactNode } from "react";
import {
  BookOpen,
  Calendar,
  LayoutDashboard,
  Plus,
  Settings,
  Sun,
  Tag as TagIcon,
  Zap,
} from "lucide-react";
import { Badge, Button, Card, IconButton, Input, Switch, Tabs, Tag, Toast } from "../components/ds";
import { TaskLine } from "../features/tasks/TaskLine";
import { TaskEditor } from "../features/tasks/TaskEditor";
import { useTaskStore } from "../features/tasks/store";
import { useActivityStore } from "../features/activity/store";
import { syncDotColor, syncLabel, useSyncStore } from "../features/sync/obsidianSync";
import { parseCapture } from "../lib/parse";
import type { Task } from "../lib/types";
import { startOfDay } from "../lib/due";
import { SettingsScreen } from "./SettingsScreen";
import { TodayScreen } from "./TodayScreen";
import { TagsScreen } from "./TagsScreen";
import { UpcomingScreen } from "./UpcomingScreen";
import { useClock } from "../lib/useClock";
import "./desktop.css";

const NAV = [
  { id: "dashboard", label: "ダッシュボード", Icon: LayoutDashboard },
  { id: "today", label: "今日", Icon: Sun },
  { id: "upcoming", label: "予定", Icon: Calendar },
  { id: "tags", label: "タグ", Icon: TagIcon },
  { id: "settings", label: "設定", Icon: Settings },
] as const;

const RANGES = [
  { value: "today", label: "今日" },
  { value: "week", label: "今週" },
  { value: "month", label: "今月" },
] as const;

const TOAST_MS = 2400;

/** Minutes parsed out of an estimate string like `30m`, `2h`, `45分`, `1時間`. */
function estMinutes(est: string): number {
  const m = /(\d+)\s*([mh分]|時間)?/.exec(est);
  if (!m) return 0;
  const n = Number(m[1]);
  return m[2] === "h" || m[2] === "時間" ? n * 60 : n;
}

export function DesktopDashboard() {
  const now = useClock(30_000);
  const tasks = useTaskStore((s) => s.tasks);
  const capture = useTaskStore((s) => s.capture);
  const toggle = useTaskStore((s) => s.toggle);
  const editTask = useTaskStore((s) => s.editTask);
  const removeTask = useTaskStore((s) => s.removeTask);
  const activity = useActivityStore((s) => s.entries);
  const aiEnabled = useTaskStore((s) => s.aiEnabled);
  const setAiEnabled = useTaskStore((s) => s.setAiEnabled);
  const sync = useSyncStore();

  const [nav, setNav] = useState<(typeof NAV)[number]["id"]>("dashboard");
  const [range, setRange] = useState<(typeof RANGES)[number]["value"]>("today");
  const [value, setValue] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [editing, setEditing] = useState<Task | null>(null);

  const open = useMemo(() => tasks.filter((t) => !t.done), [tasks]);
  const completion = tasks.length
    ? Math.round(((tasks.length - open.length) / tasks.length) * 100)
    : 0;
  const autoTagged = tasks.filter((t) => t.tagSource === "ai").length;
  const focusHours = (
    open.reduce((sum, t) => sum + estMinutes(t.est), 0) / 60
  ).toFixed(1);
  const importantCount = open.filter((t) => t.important).length;

  const tagDist = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of tasks) counts.set(t.tag, (counts.get(t.tag) ?? 0) + 1);
    const total = tasks.length || 1;
    return [...counts.entries()]
      .map(([tag, n]) => ({ tag, n, pct: Math.round((n / total) * 100) }))
      .sort((a, b) => b.n - a.n);
  }, [tasks]);

  // 今日 / 今週 / 今月 bound the focus list by due date. Tasks with no date
  // always show — an undated task is not "outside" any range.
  const inRange = useMemo(() => {
    const today = startOfDay(now);
    const span = range === "today" ? 1 : range === "week" ? 7 : 31;
    const until = today + span * 86_400_000;
    return tasks.filter((t) => t.dueAt == null || t.dueAt < until);
  }, [tasks, range, now]);

  const parsed = parseCapture(value);

  const submit = () => {
    if (!value.trim()) return;
    capture(value);
    setValue("");
    setToast("保存しました — AI が文脈を解析中");
    window.setTimeout(() => setToast(null), TOAST_MS);
  };

  const dateLabel = new Date(now)
    .toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" })
    .replace(/\//g, ".");

  return (
    <div className="desk">
      <aside className="desk__rail">
        <div className="desk__wordmark">
          Life<span style={{ color: "var(--accent)" }}>Quest</span>
        </div>
        <nav className="desk__nav">
          {NAV.map(({ id, label, Icon }) => {
            const active = nav === id;
            return (
              <button
                key={id}
                type="button"
                className={active ? "ds-navitem ds-navitem--active" : "ds-navitem"}
                onClick={() => setNav(id)}
                aria-current={active ? "page" : undefined}
              >
                {active && <span className="ds-navitem__accent" aria-hidden />}
                <Icon size={16} style={active ? { color: "var(--ice-500)" } : undefined} />
                {label}
              </button>
            );
          })}
        </nav>
        <div className="desk__rail-footer" aria-hidden />
      </aside>

      <main className="desk__main">
        {nav !== "dashboard" && (
          <div className="desk__subpage">
            {nav === "settings" ? (
              <SettingsScreen />
            ) : nav === "tags" ? (
              <TagsScreen onOpen={setEditing} />
            ) : nav === "upcoming" ? (
              <UpcomingScreen now={now} onOpen={setEditing} />
            ) : (
              <TodayScreen now={now} onOpen={setEditing} />
            )}
          </div>
        )}
        {nav === "dashboard" && (<>
        {/* Two sparse cross marks in genuinely empty canvas — never over a card. */}
        <span className="motif-cross" style={{ left: "47%", top: 52, color: "var(--ice-500)", opacity: 0.4 }}>
          ✕
        </span>
        <span className="motif-cross" style={{ right: 30, bottom: 8, color: "var(--gold-500)", opacity: 0.7 }}>
          ✕
        </span>

        <header className="desk__header">
          <div>
            <h1 className="desk__hero">TODAY</h1>
            <div className="desk__subline">
              {dateLabel} · {open.length} OPEN
            </div>
            <div className="desk__sync">
              <span
                className="desk__sync-dot"
                style={{ background: syncDotColor(sync.state) }}
                aria-hidden
              />
              <BookOpen size={12} style={{ color: "var(--text-tertiary)" }} />
              <span>{syncLabel(sync, now)}</span>
            </div>
          </div>
          <Tabs items={RANGES} value={range} onChange={setRange} />
        </header>

        <div className="desk__capture">
          <Input
            placeholder="タスクを入力… (#tag ~見積もり !期限 !!重要)"
            value={value}
            lit={Boolean(value)}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            icon={<Zap size={16} style={{ color: "var(--accent)" }} />}
            aria-label="タスクを入力"
            style={{ flex: 1, height: 46 }}
          />
          <Button variant="accent" onClick={submit}>
            Capture
          </Button>
        </div>

        {(parsed.tag || parsed.est || parsed.due || parsed.important) && (
          <div className="desk__parsed">
            <span className="desk__parsed-label">PARSED</span>
            {parsed.tag && <Tag active>{parsed.tag}</Tag>}
            {parsed.est && <Badge tone="brand">~{parsed.est}</Badge>}
            {parsed.due && <Badge tone="accent">{parsed.due}</Badge>}
            {parsed.important && <Badge tone="accent">重要</Badge>}
          </div>
        )}

        {toast && <Toast tone="success">{toast}</Toast>}

        <div className="desk__stats">
          <Stat label="Open tasks" value={open.length} hint={`うち ${importantCount} 件が重要`} />
          <Stat label="Completion" value={completion} unit="%" hint="完了率" />
          <Stat label="AI auto-tags" value={autoTagged} unit="件" hint="自動付与" glow />
          <Stat label="Focus time" value={focusHours} unit="h" hint="未完了見積もりの合計" />
        </div>

        <div className="desk__grid">
          <Panel
            title="今日のフォーカス"
            action={<IconButton icon={<Plus size={16} />} variant="solid" label="タスクを追加" />}
          >
            <div>
              {inRange.length === 0 ? (
                <div className="desk__muted">この期間に対象のタスクはありません</div>
              ) : (
                inRange.map((t) => (
                  <TaskLine key={t.id} task={t} onToggle={toggle} onOpen={setEditing} compact />
                ))
              )}
            </div>
          </Panel>

          <div className="desk__column">
            <Panel title="タグ分布">
              <div className="desk__stack">
                {tagDist.map((d) => (
                  <div key={d.tag}>
                    <div className="desk__bar-head">
                      <Tag>{d.tag}</Tag>
                      <span className="desk__bar-value">
                        {d.n} · {d.pct}%
                      </span>
                    </div>
                    <div className="desk__bar-track">
                      <div className="desk__bar-fill" style={{ width: `${d.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="AI アクティビティ">
              <div className="desk__stack">
                {activity.length === 0 ? (
                  <div className="desk__muted">まだ解析ログはありません</div>
                ) : (
                  activity.map((a) => (
                    <div key={a.id} className="desk__activity">
                      <span className="desk__activity-time">
                        {new Date(a.at).toLocaleTimeString("ja-JP", {
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: false,
                        })}
                      </span>
                      <span
                        className="desk__activity-dot"
                        style={{
                          background:
                            a.tone === "success"
                              ? "var(--green-500)"
                              : a.tone === "brand"
                                ? "var(--ice-400)"
                                : a.tone === "danger"
                                  ? "var(--red-500)"
                                  : "var(--mist-600)",
                          boxShadow: a.tone === "brand" ? "var(--glow-ice)" : "none",
                        }}
                      />
                      <span className="desk__activity-text">{a.text}</span>
                    </div>
                  ))
                )}
              </div>
            </Panel>

            <Panel
              title="バックグラウンド処理"
              action={
                <Switch
                  checked={aiEnabled}
                  onChange={() => setAiEnabled(!aiEnabled)}
                  label="AI の自動タグ付け"
                />
              }
            >
              <div className="desk__muted">
                保存はローカル DB で即時。AI 解析は非同期のため、オフラインでも入力は止まりません。
              </div>
            </Panel>
          </div>
        </div>
        </>)}
      </main>

      {editing && (
        <TaskEditor
          task={tasks.find((t) => t.id === editing.id) ?? editing}
          onSave={editTask}
          onDelete={removeTask}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  unit,
  hint,
  glow,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  hint?: string;
  glow?: boolean;
}) {
  return (
    <Card
      style={{
        flex: 1,
        padding: "16px 18px",
        boxShadow: glow ? "var(--shadow-md), var(--shadow-mist)" : "var(--shadow-mist)",
      }}
    >
      <div className="desk__stat-label">{label}</div>
      <div className="desk__stat-row">
        <span className="desk__stat-value" style={{ color: glow ? "var(--ice-500)" : "var(--text-primary)" }}>
          {value}
        </span>
        {unit && <span className="desk__stat-unit">{unit}</span>}
      </div>
      {hint && <div className="desk__stat-hint">{hint}</div>}
    </Card>
  );
}

function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="desk__panel-head">
        <div className="desk__panel-title">{title}</div>
        {action}
      </div>
      {children}
    </Card>
  );
}
