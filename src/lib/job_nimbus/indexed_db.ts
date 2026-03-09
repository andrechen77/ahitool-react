let db: IDBDatabase | null = null;

const DB_NAME = "job_nimbus_db";
const STORE_NAME_CACHE = "job_nimbus_data";

async function getJnDb(): Promise<IDBDatabase> {
    function openDb() {
        return new Promise<IDBDatabase>((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, 1);
            req.onupgradeneeded = () => {
                const db = req.result;
                for (const name of db.objectStoreNames) {
                    db.deleteObjectStore(name);
                }
                db.createObjectStore(STORE_NAME_CACHE);
            };
            req.onerror = reject;
            req.onsuccess = () => {
                resolve(req.result);
            };
        });
    }
    if (db === null) {
        db = await openDb();
    }
    return db;
}

export async function jnCacheLoadOrCalculate<T>(
    key: string,
    calculate: () => Promise<T>,
): Promise<T> {
    const cached = await jnCacheLoad(key);
    if (cached !== undefined) {
        return cached as T;
    }
    const value = await calculate();
    await jnCacheStore(key, value);
    return value;
}

async function jnCacheLoad<T>(key: string): Promise<T | undefined> {
    const db = await getJnDb();
    const tx = db.transaction(STORE_NAME_CACHE, "readonly");
    const store = tx.objectStore(STORE_NAME_CACHE);
    const request = store.get(key);
    return new Promise((resolve, reject) => {
        request.onsuccess = () => {
            resolve(request.result);
        };
        request.onerror = reject;
    });
}

async function jnCacheStore(key: string, value: unknown): Promise<void> {
    const db = await getJnDb();
    const tx = db.transaction(STORE_NAME_CACHE, "readwrite");
    const store = tx.objectStore(STORE_NAME_CACHE);
    const request = store.put(value, key);
    return new Promise((resolve, reject) => {
        request.onsuccess = () => {
            resolve();
        };
        request.onerror = reject;
    });
}

export async function jnCacheClear(): Promise<void> {
    const db = await getJnDb();
    const tx = db.transaction(STORE_NAME_CACHE, "readwrite");
    const store = tx.objectStore(STORE_NAME_CACHE);
    const request = store.clear();
    return new Promise((resolve, reject) => {
        request.onsuccess = () => {
            resolve();
        };
        request.onerror = reject;
    });
}
