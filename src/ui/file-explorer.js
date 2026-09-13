import {
  isSupported,
  pickDirectory,
  getRememberedDirectory,
  hasPermission,
  ensurePermission,
  listMidiFiles,
  writeFile,
} from '../core/fs-access.js';
import { recordingFilename } from '../util/recording-filename.js';

/**
 * Explorateur de dossier (File System Access API) pour l'enregistreur intégré — Phase B, Étape
 * B4. Complète le téléchargement classique (Étape B3, toujours dispo) par un aller-retour direct
 * avec une clé USB : choisir le dossier `MUSICDAT/` une fois, puis enregistrer dedans à chaque
 * prise sans repasser par le dossier Téléchargements. Se masque entièrement si l'API n'est pas
 * supportée (Firefox/Safari) — Étape B3 reste alors le seul chemin de sauvegarde, sans rien à
 * faire de spécial côté appelant.
 * @param {HTMLElement} container  doit contenir #explorer-action/#explorer-dirname/#explorer-save/#explorer-files/#explorer-status
 * @param {() => import('../core/recorder.js').Recorder} getRecorder
 */
export function mountFileExplorer(container, getRecorder) {
  if (!isSupported()) {
    container.hidden = true;
    return;
  }
  container.hidden = false;

  const actionBtn = container.querySelector('#explorer-action');
  const dirNameEl = container.querySelector('#explorer-dirname');
  const saveBtn = container.querySelector('#explorer-save');
  const fileListEl = container.querySelector('#explorer-files');
  const statusEl = container.querySelector('#explorer-status');

  /** @type {FileSystemDirectoryHandle | null} */
  let dirHandle = null;
  /** @type {FileSystemDirectoryHandle | null} handle mémorisé mais permission pas (encore) confirmée */
  let pendingHandle = null;

  actionBtn.addEventListener('click', async () => {
    try {
      if (pendingHandle) {
        if (await ensurePermission(pendingHandle)) {
          dirHandle = pendingHandle;
          pendingHandle = null;
        } else {
          setStatus("Permission refusée — choisis à nouveau le dossier si besoin.");
          return;
        }
      } else {
        dirHandle = await pickDirectory();
      }
      setStatus('');
      await refresh();
    } catch (err) {
      if (err.name !== 'AbortError') setStatus(`Erreur : ${err.message}`);
    }
  });

  saveBtn.addEventListener('click', async () => {
    if (!dirHandle) return;
    const recorder = getRecorder();
    if (recorder.state !== 'stopped') return;
    const name = recordingFilename();
    try {
      await writeFile(dirHandle, name, recorder.toMidi().toArray());
      setStatus(`Enregistré : ${name}`);
      await refresh();
    } catch (err) {
      setStatus(`Erreur d'écriture : ${err.message}`);
    }
  });

  async function refresh() {
    const active = dirHandle && !pendingHandle;

    dirNameEl.textContent = dirHandle
      ? active
        ? dirHandle.name
        : `${dirHandle.name} (permission à confirmer)`
      : 'Aucun dossier choisi';

    actionBtn.textContent = pendingHandle
      ? "Ré-autoriser l'accès"
      : dirHandle
        ? 'Changer de dossier'
        : 'Choisir un dossier';

    saveBtn.hidden = !active || getRecorder().state !== 'stopped';

    if (!active) {
      fileListEl.innerHTML = '';
      return;
    }
    const files = await listMidiFiles(dirHandle);
    fileListEl.innerHTML = files.length
      ? files
          .map((f) => `<li>${escapeHtml(f.name)} <span class="explorer-file-size">${formatSize(f.size)}</span></li>`)
          .join('')
      : '<li class="explorer-empty">Aucun fichier .mid dans ce dossier.</li>';
  }

  function setStatus(text) {
    statusEl.textContent = text;
  }

  (async () => {
    const remembered = await getRememberedDirectory();
    if (!remembered) {
      await refresh();
      return;
    }
    if (await hasPermission(remembered)) {
      dirHandle = remembered;
    } else {
      // Ne pas appeler requestPermission ici : hors geste utilisateur, les navigateurs
      // l'ignorent silencieusement. On attend un clic sur actionBtn pour la redemander.
      pendingHandle = remembered;
    }
    await refresh();
  })();

  return { refresh };
}

/** @param {number} bytes */
function formatSize(bytes) {
  return bytes < 1024 ? `${bytes} o` : `${(bytes / 1024).toFixed(1)} ko`;
}

/** @param {string} text */
function escapeHtml(text) {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
