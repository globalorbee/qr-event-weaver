// Tiny IndexedDB wrapper for cached scan check-ins.
// Falls back to localStorage when IDB is unavailable.

const DB_NAME = "passly-gatekeeper";
const STORE = "scans";

export type CachedScan = {
  passCode: string;
  eventId: string;
  attendeeId: string;
  scannedAt: number;
  synced: boolean;
};

function open(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === "undefined") return resolve(null);
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "passCode" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

function lsKey(passCode: string) {
  return `passly:scan:${passCode}`;
}

export async function recordScan(scan: CachedScan): Promise<void> {
  const db = await open();
  if (!db) {
    try { localStorage.setItem(lsKey(scan.passCode), JSON.stringify(scan)); } catch {}
    return;
  }
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(scan);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

export async function getScan(passCode: string): Promise<CachedScan | null> {
  const db = await open();
  if (!db) {
    try {
      const raw = localStorage.getItem(lsKey(passCode));
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(passCode);
    req.onsuccess = () => resolve((req.result as CachedScan) ?? null);
    req.onerror = () => resolve(null);
  });
}

export async function getUnsynced(): Promise<CachedScan[]> {
  const db = await open();
  if (!db) return [];
  return new Promise((resolve) => {
    const out: CachedScan[] = [];
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).openCursor();
    req.onsuccess = () => {
      const cur = req.result;
      if (cur) {
        const v = cur.value as CachedScan;
        if (!v.synced) out.push(v);
        cur.continue();
      } else resolve(out);
    };
    req.onerror = () => resolve(out);
  });
}

export async function markSynced(passCodes: string[]): Promise<void> {
  const db = await open();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    passCodes.forEach((pc) => {
      const r = store.get(pc);
      r.onsuccess = () => {
        const v = r.result as CachedScan | undefined;
        if (v) store.put({ ...v, synced: true });
      };
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}