const DB_NAME = 'tracker-db'
const DB_VERSION = 1
const STORE_NAME = 'state'
const APP_STATE_KEY = 'main'
const FALLBACK_STORAGE_KEY = 'tracker-app-state'

let dbPromise

function openDatabase() {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB unavailable'))
  }

  if (dbPromise) {
    return dbPromise
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }

    request.onsuccess = () => {
      resolve(request.result)
    }

    request.onerror = () => {
      reject(request.error)
    }
  })

  return dbPromise
}

function withStore(mode, handler) {
  return openDatabase().then(
    (db) =>
      new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, mode)
        const store = transaction.objectStore(STORE_NAME)
        const request = handler(store)

        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      }),
  )
}

export function loadAppState() {
  return withStore('readonly', (store) => store.get(APP_STATE_KEY)).catch(() => {
    if (typeof localStorage === 'undefined') {
      return null
    }

    try {
      const raw = localStorage.getItem(FALLBACK_STORAGE_KEY)
      if (!raw) return null
      return JSON.parse(raw)
    } catch {
      return null
    }
  })
}

export function saveAppState(state) {
  const payload = {
    ...state,
    savedAt: new Date().toISOString(),
  }

  return withStore('readwrite', (store) => store.put(payload, APP_STATE_KEY)).catch(() => {
    if (typeof localStorage === 'undefined') {
      throw new Error('No browser storage available')
    }

    localStorage.setItem(FALLBACK_STORAGE_KEY, JSON.stringify(payload))
    return APP_STATE_KEY
  })
}
