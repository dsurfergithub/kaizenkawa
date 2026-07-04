import type { Kit, Pad } from './types';
import { PAD_GROUPS, STEPS } from './types';

/** Rellena campos añadidos después de que existieran kits guardados. */
function normalizeKit(kit: Kit): Kit {
  return {
    ...kit,
    bpm: kit.bpm ?? 100,
    pads: kit.pads.map(
      (p, i): Pad => ({
        ...p,
        group: p.group ?? PAD_GROUPS[Math.floor(i / 4) % PAD_GROUPS.length],
        pattern: p.pattern ?? new Array<boolean>(STEPS).fill(false),
      }),
    ),
  };
}

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
    all.map(normalizeKit).sort((a, b) => b.createdAt - a.createdAt),
  );
}

export function deleteKit(id: string): Promise<undefined> {
  return tx('readwrite', (s) => s.delete(id));
}
