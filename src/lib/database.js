const DB_NAME = 'tracker-db'
const DB_VERSION = 1
const STORE_NAME = 'state'
const APP_STATE_KEY = 'main'
const FALLBACK_STORAGE_KEY = 'tracker-app-state'
const REMOTE_STATE_ENDPOINT = '/api/state'

let dbPromise
let storageStatus = {
  mode: 'unknown',
  reason: '',
}

function setStorageStatus(mode, reason = '') {
  storageStatus = { mode, reason }
}

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

function loadLocalState() {
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

function saveLocalState(payload) {
  return withStore('readwrite', (store) => store.put(payload, APP_STATE_KEY)).catch(() => {
    if (typeof localStorage === 'undefined') {
      throw new Error('No browser storage available')
    }

    localStorage.setItem(FALLBACK_STORAGE_KEY, JSON.stringify(payload))
    return APP_STATE_KEY
  })
}

async function loadRemoteState() {
  const response = await fetch(REMOTE_STATE_ENDPOINT, {
    method: 'GET',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Remote load failed with ${response.status}`)
  }

  const data = await response.json()
  setStorageStatus('server')
  return data?.state ?? null
}

async function saveRemoteState(payload) {
  const response = await fetch(REMOTE_STATE_ENDPOINT, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ state: payload }),
  })

  if (!response.ok) {
    throw new Error(`Remote save failed with ${response.status}`)
  }

  setStorageStatus('server')
}

export function getStorageStatus() {
  return storageStatus
}

export async function loadAppState() {
  try {
    const remoteState = await loadRemoteState()
    if (remoteState && typeof remoteState === 'object') return remoteState
    return null
  } catch (error) {
    setStorageStatus('local', error instanceof Error ? error.message : 'Remote unavailable')
    // Fall back to local storage when remote API is unavailable.
  }

  return loadLocalState()
}

export async function saveAppState(state) {
  const payload = {
    ...state,
    savedAt: new Date().toISOString(),
  }

  let remoteSaved = false
  let remoteErrorReason = ''
  try {
    await saveRemoteState(payload)
    remoteSaved = true
  } catch (error) {
    remoteErrorReason = error instanceof Error ? error.message : 'Remote save unavailable'
    // Keep local persistence path as fallback/offline support.
  }

  try {
    await saveLocalState(payload)
  } catch (localError) {
    if (!remoteSaved) {
      throw localError
    }
  }

  if (!remoteSaved) {
    setStorageStatus('local', remoteErrorReason || 'Using browser-local storage only')
  }

  return APP_STATE_KEY
}
