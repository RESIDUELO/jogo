// Wrapper mínimo de IndexedDB (sem dependências).
const DB_NAME = 'residuelo';
const DB_VERSION = 1;
export const STORES = { questions: 'questions', meta: 'meta' } as const;

let dbp: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB indisponível'));
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORES.questions)) db.createObjectStore(STORES.questions, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(STORES.meta)) db.createObjectStore(STORES.meta);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  return open().then(
    (db) =>
      new Promise<T | undefined>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const s = t.objectStore(store);
        const r = fn(s);
        t.oncomplete = () => resolve(r ? (r.result as T) : undefined);
        t.onerror = () => reject(t.error);
      }),
  );
}

export const idb = {
  getAll: <T>(store: string) => tx<T[]>(store, 'readonly', (s) => s.getAll()).then((r) => r ?? []),
  get: <T>(store: string, key: IDBValidKey) => tx<T>(store, 'readonly', (s) => s.get(key)),
  put: (store: string, value: unknown, key?: IDBValidKey) => tx(store, 'readwrite', (s) => s.put(value, key)).then(() => undefined),
  putMany: (store: string, values: unknown[]) =>
    tx(store, 'readwrite', (s) => {
      values.forEach((v) => s.put(v));
    }).then(() => undefined),
  del: (store: string, key: IDBValidKey) => tx(store, 'readwrite', (s) => s.delete(key)).then(() => undefined),
  clear: (store: string) => tx(store, 'readwrite', (s) => s.clear()).then(() => undefined),
};
