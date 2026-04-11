import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';

interface POSDB extends DBSchema {
  offlineQueue: {
    key: string;
    value: {
      id: string;
      url: string;
      method: string;
      data: any;
      headers: any;
      timestamp: number;
    };
  };
}

let dbPromise: Promise<IDBPDatabase<POSDB>> | null = null;

const getDB = () => {
  if (!dbPromise) {
    dbPromise = openDB<POSDB>('mumo-pos-offline-db', 1, {
      upgrade(db) {
        db.createObjectStore('offlineQueue', { keyPath: 'id' });
      },
    });
  }
  return dbPromise;
};

export const enqueueRequest = async (request: { url: string; method: string; data: any; headers: any }) => {
  const db = await getDB();
  const id = crypto.randomUUID();
  await db.put('offlineQueue', {
    ...request,
    id,
    timestamp: Date.now(),
  });
  // Dispatch an event to notify the UI that an offline request was queued
  window.dispatchEvent(new CustomEvent('offline-queue-updated'));
  return id;
};

export const getQueue = async () => {
  const db = await getDB();
  return await db.getAll('offlineQueue');
};

export const dequeueRequest = async (id: string) => {
  const db = await getDB();
  await db.delete('offlineQueue', id);
  window.dispatchEvent(new CustomEvent('offline-queue-updated'));
};

// Also expose a way to count the queue
export const getQueueCount = async () => {
  const db = await getDB();
  return await db.count('offlineQueue');
};
