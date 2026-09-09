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
