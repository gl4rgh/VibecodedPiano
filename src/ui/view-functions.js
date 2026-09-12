import { TONES, TONE_CATEGORIES } from '../data/tones.js';
import { ARPEGGIATOR_TYPES } from '../data/arpeggiator-types.js';
import { AUTO_HARMONIZE_TYPES } from '../data/auto-harmonize-types.js';

/**
 * Panneau « Fonctionnalités » : pure référence, rien n'est envoyé au piano. Recherche parmi les
 * 700 sons pour connaître le numéro à composer sur l'instrument, et tables de référence pour
 * l'arpégiateur (100 types) et l'auto harmonize (12 types) — aucun des trois n'est pilotable en
 * MIDI sur ce piano (Upper1, la partie qui sonne au clavier, n'a pas de canal de réception MIDI ;
 * voir datamining/README.md §0), donc tout se règle à la main sur l'instrument.
 *
 * @param {HTMLElement} toggleBtn
 * @param {HTMLElement} panel
 * @returns {{ open: () => void, close: () => void, toggle: () => void }}
 */
export function mountFunctionsPanel(toggleBtn, panel) {
  const searchInput = panel.querySelector('#functions-tone-search');
  const toneSelect = panel.querySelector('#functions-tone-select');
  const toneSelectedEl = panel.querySelector('#functions-tone-selected');
  const arpeggioListEl = panel.querySelector('#functions-arpeggio-list');
  const harmonizeListEl = panel.querySelector('#functions-harmonize-list');
  const closeBtn = panel.querySelector('#functions-close');

  populateTones();
  populateReferenceLists();

  function populateTones() {
    for (const { name, tones } of TONE_CATEGORIES) {
      const group = document.createElement('optgroup');
      group.label = name;
      for (const tone of tones) {
        const option = new Option(`${tone.number}. ${tone.name}${tone.dsp ? ' (DSP)' : ''}`, String(tone.number));
        group.appendChild(option);
      }
      toneSelect.appendChild(group);
    }
  }

  function populateReferenceLists() {
    for (const { number, name } of ARPEGGIATOR_TYPES) {
      const li = document.createElement('li');
      li.textContent = `${number}. ${name}`;
      arpeggioListEl.appendChild(li);
    }
    for (const { number, name, description } of AUTO_HARMONIZE_TYPES) {
      const li = document.createElement('li');
      li.innerHTML = `<strong>${number}. ${escapeHtml(name)}</strong> — ${escapeHtml(description)}`;
      harmonizeListEl.appendChild(li);
    }
  }

  searchInput.addEventListener('input', () => {
    const query = searchInput.value.trim().toLowerCase();
    for (const option of toneSelect.options) {
      option.hidden = query !== '' && !option.textContent.toLowerCase().includes(query);
    }
    for (const group of toneSelect.querySelectorAll('optgroup')) {
      group.hidden = !Array.from(group.children).some((o) => !o.hidden);
    }
  });

  toneSelect.addEventListener('change', () => {
    const tone = TONES.find((t) => t.number === Number(toneSelect.value));
    if (!tone) return;
    toneSelectedEl.textContent =
      `${tone.name} → compose le numéro ${tone.number} sur le piano (catégorie ${tone.category}).`;
  });

  closeBtn.addEventListener('click', close);
  toggleBtn.addEventListener('click', toggle);

  function open() {
    panel.hidden = false;
    toggleBtn.setAttribute('aria-expanded', 'true');
  }

  function close() {
    panel.hidden = true;
    toggleBtn.setAttribute('aria-expanded', 'false');
  }

  function toggle() {
    if (panel.hidden) open();
    else close();
  }

  return { open, close, toggle };
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
