import { mountLibraryView } from './ui/view-library.js';
import { mountEditorView } from './ui/view-editor.js';
import { mountPlayView } from './ui/view-play.js';

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

// --- Réglage provisoire de notation des notes (anglais/solfège). Deviendra un vrai réglage
// persisté (core/store.js) en P6.
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
