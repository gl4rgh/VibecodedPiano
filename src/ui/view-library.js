import { getDocument } from '../pdf/pdf-loader.js';
import { parseReference } from '../core/midi-reference.js';
import { createPiece, listPieces, deletePiece } from '../core/store.js';

/**
 * Vue « Bibliothèque » : import PDF+MIDI+titre -> création d'un Piece (IndexedDB via
 * core/store.js), liste des morceaux, ouverture (navigue vers #/editor/:id), suppression.
 * @param {HTMLElement} container
 * @returns {{ refresh: () => Promise<void> }}
 */
export function mountLibraryView(container) {
  const form = container.querySelector('#library-add-form');
  const titleInput = container.querySelector('#library-title-input');
  const pdfInput = container.querySelector('#library-pdf-input');
  const midiInput = container.querySelector('#library-midi-input');
  const submitBtn = container.querySelector('#library-add-submit');
  const statusEl = container.querySelector('#library-add-status');
  const listEl = container.querySelector('#library-list');

  async function refresh() {
    const pieces = await listPieces();
    pieces.sort((a, b) => b.updatedAt - a.updatedAt);
    listEl.innerHTML = '';

    if (pieces.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'library-empty';
      empty.textContent = 'Aucun morceau importé pour le moment.';
      listEl.appendChild(empty);
      return;
    }

    for (const piece of pieces) {
      const li = document.createElement('li');
      li.className = 'library-item';

      const info = document.createElement('div');
      info.className = 'library-item-info';
      info.innerHTML =
        `<strong>${escapeHtml(piece.title)}</strong>` +
        `<span class="library-item-meta">${piece.pageCount} page(s) · ` +
        `${piece.eventCount} événements · ${piece.anchors.length} ancre(s)</span>`;

      const actions = document.createElement('div');
      actions.className = 'library-item-actions';

      const playBtn = document.createElement('button');
      playBtn.type = 'button';
      playBtn.className = 'library-play-btn';
      playBtn.textContent = 'Jouer';
      playBtn.disabled = piece.anchors.length === 0;
      playBtn.title = piece.anchors.length === 0 ? "Pose d'abord des ancres dans l'éditeur" : '';
      playBtn.addEventListener('click', () => {
        location.hash = `#/play/${piece.id}`;
      });

      const openBtn = document.createElement('button');
      openBtn.type = 'button';
      openBtn.textContent = 'Ouvrir';
      openBtn.addEventListener('click', () => {
        location.hash = `#/editor/${piece.id}`;
      });

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'library-delete-btn';
      deleteBtn.textContent = 'Supprimer';
      deleteBtn.addEventListener('click', async () => {
        if (!confirm(`Supprimer « ${piece.title} » ?`)) return;
        await deletePiece(piece.id);
        await refresh();
      });

      actions.append(playBtn, openBtn, deleteBtn);
      li.append(info, actions);
      listEl.appendChild(li);
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = titleInput.value.trim();
    const pdfFile = pdfInput.files?.[0];
    const midiFile = midiInput.files?.[0];
    if (!title || !pdfFile || !midiFile) return;

    submitBtn.disabled = true;
    statusEl.textContent = 'Import en cours…';
    statusEl.classList.remove('error');

    try {
      const midiBuf = await midiFile.arrayBuffer();
      const { events } = parseReference(midiBuf);

      const pdfBuf = await pdfFile.arrayBuffer();
      const pdfDoc = await getDocument(pdfBuf);
      const pageCount = pdfDoc.numPages;
      await pdfDoc.destroy();

      await createPiece({
        title,
        pdfBlob: pdfFile,
        midiBlob: midiFile,
        eventCount: events.length,
        pageCount,
      });

      form.reset();
      statusEl.textContent = '';
      await refresh();
    } catch (err) {
      console.error('[library] import échoué', err);
      statusEl.textContent = `Import échoué : ${err.message}`;
      statusEl.classList.add('error');
    } finally {
      submitBtn.disabled = false;
    }
  });

  refresh();

  return { refresh };
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
