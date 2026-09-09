import { mountLibraryView } from './ui/view-library.js';
import { mountEditorView } from './ui/view-editor.js';

const views = {
  library: document.getElementById('view-library'),
  editor: document.getElementById('view-editor'),
  play: document.getElementById('view-play'),
};

/**
 * Découpe le hash courant en { name, params }.
 * '#/library'      -> { name: 'library', params: [] }
 * '#/editor/abc'   -> { name: 'editor', params: ['abc'] }
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
  });
});

const libraryView = mountLibraryView(views.library);
const editorView = mountEditorView(views.editor);

let currentRoute = null;

function render() {
  const { name, params } = parseRoute();
  for (const [viewName, el] of Object.entries(views)) {
    el.hidden = viewName !== name;
  }

  if (name === 'library') {
    libraryView.refresh();
  } else if (name === 'editor') {
    const id = params[0];
    if (currentRoute?.name !== 'editor' || currentRoute.params[0] !== id) {
      editorView.open(id);
    }
  }

  currentRoute = { name, params };
}

window.addEventListener('hashchange', render);
render();
