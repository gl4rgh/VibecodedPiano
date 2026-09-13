import { getSetting, setSetting } from './store.js';

const DIR_HANDLE_KEY = 'recordingsDirHandle';

/** @returns {boolean} File System Access API dispo (Chrome/Edge uniquement, même contrainte que Web MIDI). */
export function isSupported() {
  return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';
}

/**
 * Ouvre le sélecteur de dossier natif et mémorise le handle choisi (IndexedDB, via store.js) pour
 * ne pas le redemander à chaque session. À appeler depuis un geste utilisateur (clic) : certains
 * navigateurs refusent silencieusement sinon.
 * @returns {Promise<FileSystemDirectoryHandle>}
 */
export async function pickDirectory() {
  const handle = await window.showDirectoryPicker({ id: 'piano-recordings', mode: 'readwrite' });
  try {
    await setSetting(DIR_HANDLE_KEY, handle);
  } catch {
    // La persistance est un confort (éviter de rechoisir à chaque session) : si elle échoue
    // (quota, navigation privée...), le dossier reste utilisable pour la session en cours.
  }
  return handle;
}

/**
 * Handle mémorisé d'une session précédente, s'il existe (FileSystemHandle est structurally
 * clonable, donc stockable directement en IndexedDB). Ne vérifie pas la permission — voir
 * `hasPermission`/`ensurePermission`.
 * @returns {Promise<FileSystemDirectoryHandle | null>}
 */
export async function getRememberedDirectory() {
  return (await getSetting(DIR_HANDLE_KEY)) ?? null;
}

/**
 * @param {FileSystemDirectoryHandle} handle
 * @returns {Promise<boolean>} true si déjà autorisé, sans redemander à l'utilisateur.
 */
export async function hasPermission(handle) {
  return (await handle.queryPermission({ mode: 'readwrite' })) === 'granted';
}

/**
 * Redemande la permission si besoin — comme `pickDirectory`, doit être appelé depuis un geste
 * utilisateur (les navigateurs ignorent silencieusement `requestPermission` sinon).
 * @param {FileSystemDirectoryHandle} handle
 * @returns {Promise<boolean>}
 */
export async function ensurePermission(handle) {
  if (await hasPermission(handle)) return true;
  return (await handle.requestPermission({ mode: 'readwrite' })) === 'granted';
}

/**
 * @param {FileSystemDirectoryHandle} dirHandle
 * @returns {Promise<{name:string, size:number}[]>} fichiers `.mid`/`.midi`, triés par nom.
 */
export async function listMidiFiles(dirHandle) {
  const files = [];
  for await (const [name, entry] of dirHandle.entries()) {
    if (entry.kind !== 'file' || !/\.midi?$/i.test(name)) continue;
    const file = await entry.getFile();
    files.push({ name, size: file.size });
  }
  return files.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * @param {FileSystemDirectoryHandle} dirHandle
 * @param {string} filename
 * @returns {Promise<ArrayBuffer>}
 */
export async function readFile(dirHandle, filename) {
  const fileHandle = await dirHandle.getFileHandle(filename);
  const file = await fileHandle.getFile();
  return file.arrayBuffer();
}

/**
 * Écrit `bytes` dans `filename` à la racine du dossier (écrase un fichier existant du même nom).
 * @param {FileSystemDirectoryHandle} dirHandle
 * @param {string} filename
 * @param {Uint8Array} bytes
 */
export async function writeFile(dirHandle, filename, bytes) {
  const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(bytes);
  await writable.close();
}
