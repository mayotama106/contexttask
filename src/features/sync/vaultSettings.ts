import { create } from "zustand";
import { getMeta, setMeta } from "../../lib/db";
import { logActivity } from "../activity/store";
import { GitHubVaultAdapter, type GitHubVaultConfig } from "./githubVault";
import { setVaultAdapter } from "./obsidianSync";

/**
 * Where the vault lives, stored on this device only — same reasoning as the
 * Anthropic key (see lib/apiKey.ts). The GitHub token is a fine-grained PAT
 * that only needs Contents: Read and write on the one repository.
 */
const KEY = "githubVault";

export interface VaultConnection extends GitHubVaultConfig {
  /** Cached from the last check so the UI can warn about a public repo. */
  isPrivate: boolean | null;
}

const EMPTY: VaultConnection = {
  token: "",
  owner: "",
  repo: "",
  branch: "main",
  path: "tasks",
  isPrivate: null,
};

interface VaultSettingsState {
  connection: VaultConnection;
  connected: boolean;
  checking: boolean;
  error: string | null;
  load: () => Promise<void>;
  connect: (next: GitHubVaultConfig) => Promise<void>;
  disconnect: () => Promise<void>;
}

export const useVaultSettings = create<VaultSettingsState>((set, get) => ({
  connection: EMPTY,
  connected: false,
  checking: false,
  error: null,

  load: async () => {
    const stored = await getMeta<VaultConnection>(KEY);
    if (!stored?.token || !stored.owner || !stored.repo) return;
    set({ connection: stored, connected: true });
    setVaultAdapter(new GitHubVaultAdapter(stored));
  },

  connect: async (next) => {
    set({ checking: true, error: null });
    const adapter = new GitHubVaultAdapter(next);
    try {
      // Verifies the token, the repo, and the permission in one call — and
      // tells us whether task content is about to land somewhere public.
      const info = await adapter.describeRepo();
      const connection: VaultConnection = { ...next, isPrivate: info.private };
      await setMeta(KEY, connection);
      set({ connection, connected: true, checking: false });
      setVaultAdapter(adapter);
      logActivity(`Vault を ${next.owner}/${next.repo} に接続`, "success");
    } catch (err) {
      set({ checking: false, error: err instanceof Error ? err.message : String(err) });
      throw err;
    }
  },

  disconnect: async () => {
    await setMeta(KEY, null);
    set({ connection: { ...EMPTY }, connected: false, error: null });
    setVaultAdapter(null);
    logActivity("Vault の接続を解除", "neutral");
    void get;
  },
}));
