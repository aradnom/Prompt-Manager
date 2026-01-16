import { openDB } from 'idb'

const DB_NAME = 'prompt-manager-db'
const STORE_NAME = 'user-preferences'
const ACTIVE_STACK_KEY = 'active-stack-id'

async function getDB() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    },
  })
}

export const storage = {
  async getActiveStackId(): Promise<number | null> {
    const db = await getDB()
    return db.get(STORE_NAME, ACTIVE_STACK_KEY)
  },

  async setActiveStackId(id: number): Promise<void> {
    const db = await getDB()
    await db.put(STORE_NAME, id, ACTIVE_STACK_KEY)
  },

  async clearActiveStackId(): Promise<void> {
    const db = await getDB()
    await db.delete(STORE_NAME, ACTIVE_STACK_KEY)
  },
}
