import type { Task } from "../../lib/types";
import type { VaultAdapter } from "./obsidianSync";
import { noteName, renderNote } from "./noteFormat";

/**
 * Writes task notes into an Obsidian vault that lives in a GitHub repository.
 *
 * This is the one sync route that works from a phone: it needs no filesystem
 * access, so it is unaffected by the sandboxing that rules out talking to the
 * Obsidian Local REST API plugin (desktop-only) from iOS.
 *
 * Uses the Git Data API rather than the Contents API so that a sync of N notes
 * is a single commit instead of N.
 */

const API = "https://api.github.com";

/** Our own record of which notes we wrote, so a reconcile never guesses. */
const MANIFEST = ".contexttask-manifest.json";

export interface GitHubVaultConfig {
  token: string;
  owner: string;
  repo: string;
  branch: string;
  /** Directory inside the repo, e.g. "tasks". Empty means the repo root. */
  path: string;
}

export class GitHubVaultError extends Error {}

interface TreeEntry {
  path: string;
  mode: "100644";
  type: "blob";
  content?: string;
  sha?: null;
}

export class GitHubVaultAdapter implements VaultAdapter {
  constructor(private readonly config: GitHubVaultConfig) {}

  private async api<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${API}${path}`, {
      ...init,
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${this.config.token}`,
        "x-github-api-version": "2022-11-28",
        ...(init?.body ? { "content-type": "application/json" } : {}),
        ...init?.headers,
      },
    });
    if (!res.ok) {
      throw new GitHubVaultError(await describeError(res));
    }
    return (await res.json()) as T;
  }

  private notePath(name: string): string {
    const dir = this.config.path.replace(/^\/+|\/+$/g, "");
    return dir ? `${dir}/${name}` : name;
  }

  /** Repo metadata — used to warn before pushing task content somewhere public. */
  async describeRepo(): Promise<{ private: boolean; defaultBranch: string }> {
    const repo = await this.api<{ private: boolean; default_branch: string }>(
      `/repos/${this.config.owner}/${this.config.repo}`,
    );
    return { private: repo.private, defaultBranch: repo.default_branch };
  }

  private async readManifest(): Promise<string[]> {
    const url = `/repos/${this.config.owner}/${this.config.repo}/contents/${encodeURIComponent(
      this.notePath(MANIFEST),
    )}?ref=${encodeURIComponent(this.config.branch)}`;
    const res = await fetch(`${API}${url}`, {
      headers: {
        accept: "application/vnd.github.raw",
        authorization: `Bearer ${this.config.token}`,
        "x-github-api-version": "2022-11-28",
      },
    });
    // No manifest yet — first sync into this repo.
    if (res.status === 404) return [];
    if (!res.ok) throw new GitHubVaultError(await describeError(res));
    try {
      const parsed: unknown = JSON.parse(await res.text());
      return Array.isArray(parsed) ? parsed.filter((n): n is string => typeof n === "string") : [];
    } catch {
      return [];
    }
  }

  async push(tasks: Task[]): Promise<void> {
    const { owner, repo, branch } = this.config;

    const desired = new Map<string, string>();
    for (const task of tasks) desired.set(noteName(task), renderNote(task));

    const previous = await this.readManifest();
    const manifestBody = JSON.stringify([...desired.keys()].sort(), null, 2);

    const entries: TreeEntry[] = [
      ...[...desired].map(([name, content]): TreeEntry => ({
        path: this.notePath(name),
        mode: "100644",
        type: "blob",
        content,
      })),
      { path: this.notePath(MANIFEST), mode: "100644", type: "blob", content: manifestBody },
    ];

    // Delete only notes our own manifest claims — a hand-written note in the
    // same folder is never in it, so it can never be removed here.
    let removed = 0;
    for (const name of previous) {
      if (desired.has(name)) continue;
      entries.push({ path: this.notePath(name), mode: "100644", type: "blob", sha: null });
      removed += 1;
    }

    const ref = await this.api<{ object: { sha: string } }>(
      `/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`,
    );
    const baseCommit = ref.object.sha;
    const commit = await this.api<{ tree: { sha: string } }>(
      `/repos/${owner}/${repo}/git/commits/${baseCommit}`,
    );

    const tree = await this.api<{ sha: string }>(`/repos/${owner}/${repo}/git/trees`, {
      method: "POST",
      body: JSON.stringify({ base_tree: commit.tree.sha, tree: entries }),
    });

    // An unchanged tree means nothing to commit — bail instead of pushing an
    // empty commit on every debounce tick.
    if (tree.sha === commit.tree.sha) return;

    const message =
      `ContextTask: ${String(desired.size)} tasks` + (removed ? `, ${String(removed)} removed` : "");
    const created = await this.api<{ sha: string }>(`/repos/${owner}/${repo}/git/commits`, {
      method: "POST",
      body: JSON.stringify({ message, tree: tree.sha, parents: [baseCommit] }),
    });

    await this.api(`/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(branch)}`, {
      method: "PATCH",
      body: JSON.stringify({ sha: created.sha }),
    });
  }
}

async function describeError(res: Response): Promise<string> {
  let detail = "";
  try {
    const body = (await res.json()) as { message?: string };
    detail = body.message ?? "";
  } catch {
    /* non-JSON error body */
  }
  switch (res.status) {
    case 401:
      return "GitHub トークンが拒否されました";
    case 403:
      return detail.includes("rate limit")
        ? "GitHub のレート制限に達しました"
        : "トークンにこのリポジトリへの書き込み権限がありません";
    case 404:
      return "リポジトリまたはブランチが見つかりません";
    case 409:
      return "リポジトリが空です。最初のコミットを作ってください";
    case 422:
      return `GitHub がリクエストを拒否しました: ${detail}`;
    default:
      return `GitHub エラー ${String(res.status)}: ${detail}`;
  }
}
