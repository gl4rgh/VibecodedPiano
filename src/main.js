import { PdfViewer } from './pdf/pdf-viewer.js';

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

function render() {
  const { name } = parseRoute();
  for (const [viewName, el] of Object.entries(views)) {
    el.hidden = viewName !== name;
  }
}

window.addEventListener('hashchange', render);
render();

// --- Test manuel P1 : import PDF direct dans la bibliothèque, sans base IndexedDB.
// Sera remplacé par ui/view-library.js en P4.
const pdfContainer = document.getElementById('pdf-container');
const pdfFileInput = document.getElementById('pdf-file-input');
const pdfZoomOut = document.getElementById('pdf-zoom-out');
const pdfZoomIn = document.getElementById('pdf-zoom-in');

if (pdfContainer && pdfFileInput) {
  const pdfViewer = new PdfViewer(pdfContainer);

  pdfFileInput.addEventListener('change', async () => {
    const file = pdfFileInput.files?.[0];
    if (!file) return;
    const { pageCount } = await pdfViewer.load(file);
    console.log(`[PDF] chargé : ${pageCount} pages`);
  });

  pdfZoomOut?.addEventListener('click', () => pdfViewer.setZoom(pdfViewer.scale - 0.2));
  pdfZoomIn?.addEventListener('click', () => pdfViewer.setZoom(pdfViewer.scale + 0.2));

  // Exposé pour vérification manuelle en console : pdfViewer.scrollToAnchor(3, 0.5)
  window.__pdfViewer = pdfViewer;
}
