import { MODES } from './modes.js'

const HISTORY_DB_NAME = 'gongkao-susuan-db'
const HISTORY_STORE_NAME = 'practice-history'

export function createEmptyHistoryByMode() {
  return Object.fromEntries(MODES.map((mode) => [mode.id, []]))
}

function openHistoryDb() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB unavailable'))
      return
    }

    const request = window.indexedDB.open(HISTORY_DB_NAME, 1)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(HISTORY_STORE_NAME)) {
        db.createObjectStore(HISTORY_STORE_NAME, { keyPath: 'modeId' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export function readAllHistoryFromDb() {
  return openHistoryDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const transaction = db.transaction(HISTORY_STORE_NAME, 'readonly')
        const store = transaction.objectStore(HISTORY_STORE_NAME)
        const request = store.getAll()

        request.onsuccess = () => {
          const historyByMode = createEmptyHistoryByMode()

          for (const item of request.result || []) {
            historyByMode[item.modeId] = Array.isArray(item.sessions)
              ? [...item.sessions].sort((a, b) => b.finishedAt - a.finishedAt)
              : []
          }

          resolve(historyByMode)
          db.close()
        }

        request.onerror = () => {
          reject(request.error)
          db.close()
        }
      }),
  )
}

export function writeModeHistoryToDb(modeId, sessions) {
  return openHistoryDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const transaction = db.transaction(HISTORY_STORE_NAME, 'readwrite')
        const store = transaction.objectStore(HISTORY_STORE_NAME)
        const request = store.put({ modeId, sessions })

        request.onsuccess = () => {
          resolve()
          db.close()
        }

        request.onerror = () => {
          reject(request.error)
          db.close()
        }
      }),
  )
}
