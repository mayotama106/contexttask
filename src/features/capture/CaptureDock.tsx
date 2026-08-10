import { useRef, useState } from "react";
import { ArrowUp, Zap } from "lucide-react";
import { Badge, Button, Input, Tag } from "../../components/ds";
import { hasTokens, insertToken, parseCapture } from "../../lib/parse";
import "./capture-dock.css";

// `!!` earns a chip: it is the one marker that is awkward to type on a phone.
const QUICK_TOKENS = ["#work", "#life", "~30m", "!今日", "!明日", "!!"] as const;

/**
 * Fixed bottom capture surface. The only rule that matters here: submitting
 * must never await anything. `onSubmit` writes to the local store and returns.
 */
export function CaptureDock({ onSubmit }: { onSubmit: (raw: string) => void }) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const parsed = parseCapture(value);

  const submit = () => {
    if (!value.trim()) return;
    onSubmit(value);
    setValue("");
    // Keep the keyboard up so consecutive captures stay fast.
    inputRef.current?.focus();
  };

  const insert = (token: string) => {
    setValue((v) => insertToken(v, token));
    inputRef.current?.focus();
  };

  return (
    <div className="capture-dock">
      {hasTokens(parsed) && (
        <div className="capture-dock__parsed">
          <span className="capture-dock__parsed-label">PARSED</span>
          {parsed.tag && <Tag active>{parsed.tag}</Tag>}
          {parsed.est && <Badge tone="brand">~{parsed.est}</Badge>}
          {parsed.due && <Badge tone="accent">{parsed.due}</Badge>}
          {parsed.important && <Badge tone="accent">重要</Badge>}
        </div>
      )}

      <div className="capture-dock__chips">
        {QUICK_TOKENS.map((token) => (
          <button
            key={token}
            type="button"
            className="ds-chip ds-hit"
            onClick={() => insert(token)}
          >
            {token}
          </button>
        ))}
      </div>

      <div className="capture-dock__row">
        <Input
          ref={inputRef}
          placeholder="タスクを入力… 打つだけで保存"
          value={value}
          lit={Boolean(value)}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          icon={<Zap size={16} style={{ color: "var(--accent)" }} />}
          enterKeyHint="done"
          autoCapitalize="off"
          autoCorrect="off"
          aria-label="タスクを入力"
          style={{ flex: 1, height: 50 }}
        />
        <Button
          variant="accent"
          onClick={submit}
          aria-label="保存"
          style={{ height: 50, width: 50, padding: 0 }}
          icon={<ArrowUp size={20} />}
        />
      </div>
    </div>
  );
}
