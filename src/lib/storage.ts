import { openDB } from "idb";

const DB_NAME = "prompt-manager-db";
const STORE_NAME = "user-preferences";
const ACTIVE_STACK_KEY = "active-stack-id";
const LM_STUDIO_URL_KEY = "lm-studio-url";

const DEFAULT_LM_STUDIO_URL = "http://localhost:11434/v1";

async function getDB() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    },
  });
}

export const storage = {
  async getActiveStackId(): Promise<number | null> {
    const db = await getDB();
    return db.get(STORE_NAME, ACTIVE_STACK_KEY);
  },

  async setActiveStackId(id: number): Promise<void> {
    const db = await getDB();
    await db.put(STORE_NAME, id, ACTIVE_STACK_KEY);
  },

  async clearActiveStackId(): Promise<void> {
    const db = await getDB();
    await db.delete(STORE_NAME, ACTIVE_STACK_KEY);
  },

  async getLMStudioUrl(): Promise<string> {
    const db = await getDB();
    return (
      (await db.get(STORE_NAME, LM_STUDIO_URL_KEY)) || DEFAULT_LM_STUDIO_URL
    );
  },

  async setLMStudioUrl(url: string): Promise<void> {
    const db = await getDB();
    await db.put(STORE_NAME, url, LM_STUDIO_URL_KEY);
  },

  DEFAULT_LM_STUDIO_URL,
};
