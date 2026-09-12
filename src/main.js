import { registerSW } from 'virtual:pwa-register';
import { mountLibraryView } from './ui/view-library.js';
import { mountEditorView } from './ui/view-editor.js';
import { mountPlayView } from './ui/view-play.js';
import { mountFunctionsPanel } from './ui/view-functions.js';
import { showBanner } from './ui/toast.js';

// PWA : registerType 'autoUpdate' télécharge la mise à jour en tâche de fond, mais n'active
// le nouveau service worker qu'après confirmation — un reload silencieux au mauvais moment
// couperait le suivi MIDI en plein morceau.
const updateSW = registerSW({
  onNeedRefresh() {
    showBanner('Nouvelle version disponible.', {
      actionLabel: 'Recharger',
      onAction: () => updateSW(true),
    });
  },
});

const views = {
  library: document.getElementById('view-library'),
  editor: document.getElementById('view-editor'),
  play: document.getElementById('view-play'),
};

/**
 * Découpe le hash courant en { name, params }.
 * '#/library'      -> { name: 'library', params: [] }
 * '#/editor/abc'   -> { name: 'editor', params: ['abc'] }
 * '#/play/abc'     -> { name: 'play', params: ['abc'] }
 * ''                -> { name: 'library', params: [] }  (route par défaut)
 * @returns {{ name: string, params: string[] }}
 */
function parseRoute() {
  const hash = location.hash.replace(/^#\/?/, '');
  const [name, ...params] = hash.split('/').filter(Boolean);
  return { name: name && views[name] ? name : 'library', params };
}

// --- Réglage de notation des notes (anglais/solfège) : partagé entre les vues, pas encore
// persisté (n'est pas dans core/settings.js — seulement les réglages du matcher/viewer le sont).
let noteScheme = 'en';

document.querySelectorAll('input[name="note-scheme"]').forEach((radio) => {
  radio.addEventListener('change', () => {
    if (!radio.checked) return;
    noteScheme = radio.value;
    editorView.setNoteScheme(noteScheme);
    playView.setNoteScheme(noteScheme);
  });
});

const libraryView = mountLibraryView(views.library);
const editorView = mountEditorView(views.editor);
const playView = mountPlayView(views.play);

// Panneau global, indépendant du routeur (accessible depuis n'importe quelle vue) : voir
// fonctions.md Phase A / Étape 3. Pas encore branché à une sortie MIDI (Étape 4).
mountFunctionsPanel(
  document.getElementById('functions-toggle'),
  document.getElementById('functions-panel'),
);

let currentRoute = null;

function render() {
  const { name, params } = parseRoute();
  const previous = currentRoute;

  for (const [viewName, el] of Object.entries(views)) {
    el.hidden = viewName !== name;
  }

  if (previous?.name === 'editor' && name !== 'editor') {
    editorView.close();
  }
  if (previous?.name === 'play' && name !== 'play') {
    playView.close();
  }

  if (name === 'library') {
    libraryView.refresh();
  } else if (name === 'editor') {
    const id = params[0];
    if (previous?.name !== 'editor' || previous.params[0] !== id) {
      editorView.open(id);
    }
  } else if (name === 'play') {
    const id = params[0];
    if (previous?.name !== 'play' || previous.params[0] !== id) {
      playView.open(id);
    }
  }

  currentRoute = { name, params };
}

window.addEventListener('hashchange', render);
render();
