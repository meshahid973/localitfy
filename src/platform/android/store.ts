/** Small IndexedDB key-value store for the phone's library state (songs, playlists, settings, sync bookkeeping). */
const DB_NAME = "localtify-android";
const STORE = "kv";

let opening: Promise<IDBDatabase> | null = null;

function open() {
  opening ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return opening;
}

export async function readValue<T>(key: string, fallback: T): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const request = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
    request.onsuccess = () => resolve(request.result === undefined ? fallback : request.result as T);
    request.onerror = () => reject(request.error);
  });
}

export async function writeValues(values: Record<string, unknown>) {
  // Capture values before yielding; callers can continue editing arrays/objects while IndexedDB opens.
  const entries = Object.entries(values).map(([key, value]) => [key, structuredClone(value)] as const);
  const db = await open();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, "readwrite");
    const store = transaction.objectStore(STORE);
    for (const [key, value] of entries) store.put(value, key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}
