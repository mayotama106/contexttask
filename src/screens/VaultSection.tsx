import { useState } from "react";
import { BookOpen } from "lucide-react";
import { Badge, Button, Card, Field, Input } from "../components/ds";
import { useVaultSettings } from "../features/sync/vaultSettings";

/**
 * Connects the app to an Obsidian vault stored in a GitHub repository — the
 * only sync route that works from a phone, since it needs no filesystem access.
 */
export function VaultSection() {
  const connection = useVaultSettings((s) => s.connection);
  const connected = useVaultSettings((s) => s.connected);
  const checking = useVaultSettings((s) => s.checking);
  const error = useVaultSettings((s) => s.error);
  const connect = useVaultSettings((s) => s.connect);
  const disconnect = useVaultSettings((s) => s.disconnect);

  const [token, setToken] = useState("");
  const [owner, setOwner] = useState(connection.owner);
  const [repo, setRepo] = useState(connection.repo);
  const [branch, setBranch] = useState(connection.branch || "main");
  const [path, setPath] = useState(connection.path || "tasks");

  const ready = token.trim() && owner.trim() && repo.trim() && branch.trim();

  return (
    <Card style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="settings__head">
        <div className="settings__title">Obsidian 同期</div>
        {connected ? (
          <Badge tone={connection.isPrivate === false ? "accent" : "ice"}>
            {connection.isPrivate === false ? "公開リポジトリ" : "接続済み"}
          </Badge>
        ) : (
          <Badge tone="neutral">未接続</Badge>
        )}
      </div>

      <p className="settings__note">
        vault を GitHub リポジトリに置き、そこへタスクを Markdown で書き出します。
        ファイルへの直接アクセスが要らないので iPhone から動きます。
        Mac 側は obsidian-git などで取り込んでください。
      </p>

      {connected ? (
        <>
          <p className="settings__key">
            <BookOpen size={12} /> {connection.owner}/{connection.repo} @ {connection.branch}
            {connection.path ? ` / ${connection.path}` : ""}
          </p>
          {connection.isPrivate === false && (
            <p className="settings__bad">
              このリポジトリは公開されています。タスクの内容が誰でも読める状態です。
              プライベートなリポジトリに変更することを強く勧めます。
            </p>
          )}
          <Button variant="ghost" onClick={() => void disconnect()}>
            接続を解除
          </Button>
        </>
      ) : (
        <>
          <Field label="GitHub Token">
            <Input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              type="password"
              placeholder="github_pat_..."
              aria-label="GitHub トークン"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              style={{ height: 46 }}
            />
          </Field>
          <div className="settings__row">
            <Field label="Owner">
              <Input
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                placeholder="mayotama106"
                aria-label="オーナー"
                autoCapitalize="off"
                autoCorrect="off"
                style={{ height: 46 }}
              />
            </Field>
            <Field label="Repo">
              <Input
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
                placeholder="context_vault"
                aria-label="リポジトリ"
                autoCapitalize="off"
                autoCorrect="off"
                style={{ height: 46 }}
              />
            </Field>
          </div>
          <div className="settings__row">
            <Field label="Branch">
              <Input
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                placeholder="main"
                aria-label="ブランチ"
                autoCapitalize="off"
                autoCorrect="off"
                style={{ height: 46 }}
              />
            </Field>
            <Field label="Path">
              <Input
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder="tasks"
                aria-label="パス"
                autoCapitalize="off"
                autoCorrect="off"
                style={{ height: 46 }}
              />
            </Field>
          </div>

          <Button
            variant="accent"
            disabled={!ready || checking}
            onClick={() => {
              void connect({ token, owner, repo, branch, path }).then(
                () => setToken(""),
                () => undefined,
              );
            }}
          >
            {checking ? "確認中…" : "接続する"}
          </Button>

          {error && <p className="settings__bad">{error}</p>}

          <p className="settings__note">
            トークンは fine-grained PAT で、対象リポジトリの <strong>Contents: Read and write</strong>{" "}
            だけあれば足ります。タスク内容が入るので、必ず
            <strong>プライベートなリポジトリ</strong>を指定してください。
          </p>
        </>
      )}
    </Card>
  );
}
