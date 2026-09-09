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

const GLOBAL_SETTINGS_KEY = 'globalSettings';

let dbPromise = null;

/**
 * IndexedDB lève un DOMException 'QuotaExceededError' (nommage variable selon les navigateurs)
 * quand le quota de stockage est dépassé — typiquement en ajoutant un gros PDF/MIDI. Le
 * message brut n'est pas actionnable pour l'utilisateur ; on le remplace par un message clair
 * plutôt que de laisser remonter une DOMException opaque jusqu'à l'UI.
 * @param {unknown} err
 */
function rethrowStorageError(err) {
  const isQuotaError =
    err instanceof DOMException && (err.name === 'QuotaExceededError' || err.code === 22);
  if (isQuotaError) {
    throw new Error(
      "Stockage plein : le navigateur n'a plus de place pour sauvegarder ce morceau. " +
        'Supprime un morceau existant ou libère de l\'espace sur cet appareil.',
    );
  }
  throw err;
}

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
  try {
    await db.put(PIECES_STORE, piece);
  } catch (err) {
    rethrowStorageError(err);
  }
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
  try {
    await db.put(PIECES_STORE, updated);
  } catch (err) {
    rethrowStorageError(err);
  }
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

/** @returns {Promise<Partial<import('./settings.js').Settings>>} */
export async function getGlobalSettings() {
  return (await getSetting(GLOBAL_SETTINGS_KEY)) ?? {};
}

/** @param {Partial<import('./settings.js').Settings>} settings */
export async function setGlobalSettings(settings) {
  await setSetting(GLOBAL_SETTINGS_KEY, settings);
}
