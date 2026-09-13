import pkg from '@tonejs/midi';
import {
  isSupported,
  pickDirectory,
  getRememberedDirectory,
  hasPermission,
  ensurePermission,
  listMidiFiles,
  readFile,
  writeFile,
} from '../core/fs-access.js';
import { MidiPlayback } from '../core/midi-playback.js';
import { recordingFilename } from '../util/recording-filename.js';

const { Midi } = pkg;

/**
 * Explorateur de dossier (File System Access API) : choisir un dossier une fois (typiquement
 * `MUSICDAT/` sur la clé USB du piano), y enregistrer une prise et relire les fichiers `.mid`
 * qu'il contient. Se masque entièrement si l'API n'est pas supportée (Firefox/Safari) — le
 * téléchargement classique reste alors le seul chemin de sauvegarde, sans rien à faire côté
 * appelant.
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
  let files = [];
  let playingName = null;
  const playback = new MidiPlayback();

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

  fileListEl.addEventListener('click', async (e) => {
    const btn = e.target.closest('.explorer-play');
    if (!btn || !dirHandle) return;
    const name = btn.dataset.name;

    if (playingName === name) {
      playback.stop();
      playingName = null;
      renderFiles();
      return;
    }

    try {
      const buf = await readFile(dirHandle, name);
      const notes = new Midi(buf).tracks.flatMap((t) => t.notes);
      playingName = name;
      renderFiles();
      playback.play(notes, {
        onEnd: () => {
          playingName = null;
          renderFiles();
        },
      });
    } catch (err) {
      setStatus(`Lecture impossible : ${err.message}`);
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

    playback.stop();
    playingName = null;
    files = active ? await listMidiFiles(dirHandle) : [];
    renderFiles();
  }

  function renderFiles() {
    fileListEl.innerHTML = files.length
      ? files.map((f) => fileRowHtml(f, f.name === playingName)).join('')
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
      // Hors geste utilisateur, requestPermission() est ignoré par les navigateurs : on
      // attend un clic sur actionBtn pour la redemander plutôt que de l'appeler ici.
      pendingHandle = remembered;
    }
    await refresh();
  })();

  return { refresh };
}

/** @param {{name:string, size:number}} file @param {boolean} isPlaying */
function fileRowHtml(file, isPlaying) {
  return (
    `<li><button type="button" class="explorer-play" data-name="${escapeHtml(file.name)}">${isPlaying ? '⏹' : '▶'}</button> ` +
    `${escapeHtml(file.name)} <span class="explorer-file-size">${formatSize(file.size)}</span></li>`
  );
}

/** @param {number} bytes */
function formatSize(bytes) {
  return bytes < 1024 ? `${bytes} o` : `${(bytes / 1024).toFixed(1)} ko`;
}

/** @param {string} text */
function escapeHtml(text) {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
