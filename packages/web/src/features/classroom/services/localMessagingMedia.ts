export type LocalChatMediaKind = 'image' | 'audio' | 'video' | 'file';

export type LocalChatStoredMessage = {
  blob: Blob;
  createdAt: string;
  fileName: string;
  from: string;
  id: string;
  mediaType: LocalChatMediaKind;
  mimeType: string;
  ownerUserId: string;
  peerId: string;
  size: number;
  text?: string;
  to: string | null;
};

type LocalChatMediaStoreRecord = Omit<LocalChatStoredMessage, 'blob'> & { blobData: Blob };

type SaveLocalChatMediaInput = {
  file: File;
  from: string;
  ownerUserId: string;
  peerId: string;
  text?: string;
  to: string | null;
  mediaType: LocalChatMediaKind;
};

const DB_NAME = 'ndovera-local-chat-media';
const STORE_NAME = 'chatMedia';
const DB_VERSION = 1;

function openDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('byOwnerPeer', ['ownerUserId', 'peerId'], { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Unable to open local chat media store.'));
  });
}

function promisifyRequest<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB request failed.'));
  });
}

function toStoredMessage(record: LocalChatMediaStoreRecord): LocalChatStoredMessage {
  return {
    blob: record.blobData,
    createdAt: record.createdAt,
    fileName: record.fileName,
    from: record.from,
    id: record.id,
    mediaType: record.mediaType,
    mimeType: record.mimeType,
    ownerUserId: record.ownerUserId,
    peerId: record.peerId,
    size: record.size,
    text: record.text,
    to: record.to,
  };
}

export async function saveLocalChatMediaMessage(input: SaveLocalChatMediaInput) {
  const db = await openDb();
  const createdAt = new Date().toISOString();
  const id = `local_media_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const record: LocalChatMediaStoreRecord = {
    blobData: input.file,
    createdAt,
    fileName: input.file.name,
    from: input.from,
    id,
    mediaType: input.mediaType,
    mimeType: input.file.type || 'application/octet-stream',
    ownerUserId: input.ownerUserId,
    peerId: input.peerId,
    size: input.file.size,
    text: input.text,
    to: input.to,
  };

  try {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(record);
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error('Unable to save local chat media.'));
      transaction.onabort = () => reject(transaction.error || new Error('Unable to save local chat media.'));
    });
    return toStoredMessage(record);
  } finally {
    db.close();
  }
}

export async function listLocalChatMediaMessages(ownerUserId: string, peerId: string) {
  const db = await openDb();
  try {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('byOwnerPeer');
    const records = await promisifyRequest(index.getAll([ownerUserId, peerId]));
    return (records as LocalChatMediaStoreRecord[])
      .map(toStoredMessage)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  } finally {
    db.close();
  }
}
