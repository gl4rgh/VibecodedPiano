import { openDB } from 'idb';

const DB_NAME = 'videcoded-piano';
const DB_VERSION = 1;
const PIECES_STORE = 'pieces';
const SETTINGS_STORE = 'settings';

/**
 * @typedef {Object} Piece
 * @property {string}   id
 * @property {string}   title
 * @property {Blob}     pdfBlob
 * @property {Blob}     midiBlob
 * @property {number}   eventCount
 * @property {number}   pageCount
 * @property {import('./anchors.js').Anchor[]} anchors
 * @property {Object}   settings
 * @property {number}   createdAt
 * @property {number}   updatedAt
 */

let dbPromise = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(PIECES_STORE)) {
          db.createObjectStore(PIECES_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
          db.createObjectStore(SETTINGS_STORE, { keyPath: 'key' });
        }
      },
    });
  }
  return dbPromise;
}

/**
 * @param {{ title:string, pdfBlob:Blob, midiBlob:Blob, eventCount:number, pageCount:number, settings?:Object }} data
 * @returns {Promise<Piece>}
 */
export async function createPiece(data) {
  const now = Date.now();
  /** @type {Piece} */
  const piece = {
    id: crypto.randomUUID(),
    title: data.title,
    pdfBlob: data.pdfBlob,
    midiBlob: data.midiBlob,
    eventCount: data.eventCount,
    pageCount: data.pageCount,
    anchors: [],
    settings: data.settings ?? {},
    createdAt: now,
    updatedAt: now,
  };
  const db = await getDb();
  await db.put(PIECES_STORE, piece);
  return piece;
}

/** @returns {Promise<Piece | undefined>} */
export async function getPiece(id) {
  const db = await getDb();
  return db.get(PIECES_STORE, id);
}

/** @returns {Promise<Piece[]>} */
export async function listPieces() {
  const db = await getDb();
  return db.getAll(PIECES_STORE);
}

/**
 * Fusionne `patch` dans le Piece existant et le sauvegarde (met à jour `updatedAt`).
 * @param {string} id
 * @param {Partial<Piece>} patch
 * @returns {Promise<Piece>}
 */
export async function updatePiece(id, patch) {
  const db = await getDb();
  const existing = await db.get(PIECES_STORE, id);
  if (!existing) throw new Error(`Piece introuvable : ${id}`);
  const updated = { ...existing, ...patch, id, updatedAt: Date.now() };
  await db.put(PIECES_STORE, updated);
  return updated;
}

/** @returns {Promise<void>} */
export async function deletePiece(id) {
  const db = await getDb();
  await db.delete(PIECES_STORE, id);
}

/** @returns {Promise<*>} */
export async function getSetting(key) {
  const db = await getDb();
  const row = await db.get(SETTINGS_STORE, key);
  return row?.value;
}

/** @returns {Promise<void>} */
export async function setSetting(key, value) {
  const db = await getDb();
  await db.put(SETTINGS_STORE, { key, value });
}
