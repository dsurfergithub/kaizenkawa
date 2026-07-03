import type { Kit } from './types';

const DB_NAME = 'samplr';
const STORE = 'kits';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const req = run(db.transaction(STORE, mode).objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

export function saveKit(kit: Kit): Promise<IDBValidKey> {
  return tx('readwrite', (s) => s.put(kit));
}

export function listKits(): Promise<Kit[]> {
  return tx<Kit[]>('readonly', (s) => s.getAll() as IDBRequest<Kit[]>).then((all) =>
    all.sort((a, b) => b.createdAt - a.createdAt),
  );
}

export function deleteKit(id: string): Promise<undefined> {
  return tx('readwrite', (s) => s.delete(id));
}
