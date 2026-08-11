import { useRef, useState } from "react";
import { Download, Sparkles, Upload } from "lucide-react";
import { Badge, Button, Card, Field, Input, Switch } from "../components/ds";
import { useTaskStore } from "../features/tasks/store";
import { BackupError, downloadBackup, parseBackup } from "../lib/backup";
import { looksLikeApiKey } from "../lib/apiKey";
import { estimateCostUsd, useTaggerStore } from "../features/capture/taggerSelection";
import { VaultSection } from "./VaultSection";
import "./settings.css";

type Notice = { tone: "ok" | "bad"; text: string } | null;

export function SettingsScreen() {
  const tasks = useTaskStore((s) => s.tasks);
  const aiEnabled = useTaskStore((s) => s.aiEnabled);
  const setAiEnabled = useTaskStore((s) => s.setAiEnabled);
  const importTasks = useTaskStore((s) => s.importTasks);
  const clearAll = useTaskStore((s) => s.clearAll);
  const storageError = useTaskStore((s) => s.storageError);

  const maskedKey = useTaggerStore((s) => s.maskedKey);
  const usingClaude = useTaggerStore((s) => s.usingClaude);
  const calls = useTaggerStore((s) => s.calls);
  const inputTokens = useTaggerStore((s) => s.inputTokens);
  const outputTokens = useTaggerStore((s) => s.outputTokens);
  const setKey = useTaggerStore((s) => s.setKey);
  const removeKey = useTaggerStore((s) => s.removeKey);
  const [keyDraft, setKeyDraft] = useState("");

  const fileRef = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [confirmingClear, setConfirmingClear] = useState(false);

  const onFile = async (file: File) => {
    try {
      const result = importTasks(parseBackup(await file.text()));
      setNotice({
        tone: "ok",
        text: `${result.added} 件を追加、${result.updated} 件を更新しました`,
      });
    } catch (err) {
      setNotice({
        tone: "bad",
        text: err instanceof BackupError ? err.message : "読み込みに失敗しました",
      });
    }
  };

  return (
    <div className="settings">
      <h1 className="settings__hero">SETTINGS</h1>
      <div className="settings__subline">{tasks.length} TASKS</div>

      {storageError && (
        <Card style={{ padding: "12px 14px", borderColor: "var(--red-500)" }}>
          <div className="settings__warn">
            ローカル DB を開けませんでした。メモリ上でのみ動作しており、
            閉じると失われます。({storageError})
          </div>
        </Card>
      )}

      <Section
        title="バックアップ"
        note="このアプリはサーバを持たず、タスクは端末内だけに保存されます。定期的に書き出してください。"
      >
        <div className="settings__row">
          <Button
            variant="accent"
            icon={<Download size={16} />}
            onClick={() => downloadBackup(tasks)}
            disabled={tasks.length === 0}
          >
            書き出す
          </Button>
          <Button
            variant="ghost"
            icon={<Upload size={16} />}
            onClick={() => fileRef.current?.click()}
          >
            読み込む
          </Button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            // Reset first so re-picking the same file fires change again.
            e.target.value = "";
            if (file) void onFile(file);
          }}
        />
        <p className="settings__note">
          読み込みは上書きではなく統合です。同じ ID は新しい方が残り、既存のタスクは消えません。
        </p>
        {notice && (
          <p className={notice.tone === "ok" ? "settings__ok" : "settings__bad"}>{notice.text}</p>
        )}
      </Section>

      <Section
        title="AI タグ付け"
        note="自分の Anthropic API キーを入れると、タグと見積もりを Claude Haiku 4.5 が推定します。キーはこの端末の中だけに保存され、送信先は Anthropic だけです。未設定でもローカルの簡易推定で動きます。"
        action={
          usingClaude ? (
            <Badge tone="ice">Claude</Badge>
          ) : (
            <Badge tone="neutral">ローカル推定</Badge>
          )
        }
      >
        {maskedKey ? (
          <>
            <p className="settings__key">{maskedKey}</p>
            {calls > 0 && (
              <p className="settings__note">
                このセッション: {calls} 回 / 入力 {inputTokens.toLocaleString()} · 出力{" "}
                {outputTokens.toLocaleString()} トークン ≈ $
                {estimateCostUsd(inputTokens, outputTokens).toFixed(4)}
              </p>
            )}
            <Button variant="ghost" onClick={() => void removeKey()}>
              キーを削除
            </Button>
          </>
        ) : (
          <>
            <Field label="Anthropic API Key">
              <Input
                value={keyDraft}
                onChange={(e) => setKeyDraft(e.target.value)}
                type="password"
                placeholder="sk-ant-..."
                aria-label="Anthropic API キー"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                style={{ height: 46 }}
              />
            </Field>
            <Button
              variant="accent"
              icon={<Sparkles size={16} />}
              disabled={!looksLikeApiKey(keyDraft)}
              onClick={() => {
                void setKey(keyDraft);
                setKeyDraft("");
                setNotice({ tone: "ok", text: "キーを保存しました" });
              }}
            >
              有効にする
            </Button>
            <p className="settings__note">
              Console で<strong>使用上限</strong>を設定することを勧めます。キーは暗号化されず、
              このページのスクリプトから読める場所に保存されるためです。
            </p>
          </>
        )}
      </Section>

      <VaultSection />

      <Section
        title="バックグラウンド処理"
        note="保存はローカル DB で即時。AI 解析は非同期のため、オフラインでも入力は止まりません。"
        action={
          <Switch
            checked={aiEnabled}
            onChange={() => setAiEnabled(!aiEnabled)}
            label="AI の自動タグ付け"
          />
        }
      />

      <Section title="データの削除" note="すべてのタスクを消します。取り消せません。">
        {confirmingClear ? (
          <div className="settings__row">
            <Button variant="ghost" onClick={() => setConfirmingClear(false)}>
              やめる
            </Button>
            <button
              type="button"
              className="settings__danger"
              onClick={() => {
                clearAll();
                setConfirmingClear(false);
                setNotice({ tone: "ok", text: "すべて削除しました" });
              }}
            >
              {tasks.length} 件をすべて削除
            </button>
          </div>
        ) : (
          <Button
            variant="ghost"
            onClick={() => setConfirmingClear(true)}
            disabled={tasks.length === 0}
          >
            すべて削除
          </Button>
        )}
      </Section>
    </div>
  );
}

function Section({
  title,
  note,
  action,
  children,
}: {
  title: string;
  note?: string;
  action?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <Card style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="settings__head">
        <div className="settings__title">{title}</div>
        {action}
      </div>
      {note && <p className="settings__note">{note}</p>}
      {children}
    </Card>
  );
}
