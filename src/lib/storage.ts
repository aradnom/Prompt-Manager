const ACTIVE_STACK_KEY = "active-stack-id";
const LM_STUDIO_URL_KEY = "lm-studio-url";

const DEFAULT_LM_STUDIO_URL = "http://localhost:11434/v1";

// One-time cleanup: earlier versions kept these preferences in an IDB named
// `prompt-manager-db`. Drop it on load so stale databases don't linger in the
// browser profile.
const LEGACY_DB_NAME = "prompt-manager-db";
const LEGACY_CLEANUP_KEY = "prompt-manager-db-cleaned";
if (
  typeof indexedDB !== "undefined" &&
  !localStorage.getItem(LEGACY_CLEANUP_KEY)
) {
  try {
    indexedDB.deleteDatabase(LEGACY_DB_NAME);
    localStorage.setItem(LEGACY_CLEANUP_KEY, "1");
  } catch {
    // ignore
  }
}

export const storage = {
  async getActiveStackId(): Promise<number | null> {
    const raw = localStorage.getItem(ACTIVE_STACK_KEY);
    if (raw == null) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  },

  async setActiveStackId(id: number): Promise<void> {
    localStorage.setItem(ACTIVE_STACK_KEY, String(id));
  },

  async clearActiveStackId(): Promise<void> {
    localStorage.removeItem(ACTIVE_STACK_KEY);
  },

  async getLMStudioUrl(): Promise<string> {
    return localStorage.getItem(LM_STUDIO_URL_KEY) || DEFAULT_LM_STUDIO_URL;
  },

  async setLMStudioUrl(url: string): Promise<void> {
    localStorage.setItem(LM_STUDIO_URL_KEY, url);
  },

  DEFAULT_LM_STUDIO_URL,
};
