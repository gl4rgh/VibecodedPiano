import { TONES, TONE_CATEGORIES } from '../data/tones.js';
import { REVERB_TYPES, CHORUS_TYPES } from '../data/effects.js';
import { ARPEGGIATOR_TYPES } from '../data/arpeggiator-types.js';
import { AUTO_HARMONIZE_TYPES } from '../data/auto-harmonize-types.js';

/**
 * Panneau « Fonctionnalités » : choix du son (Bank Select + Program Change) et des effets
 * (Reverb/Chorus), plus des tables de référence en lecture seule pour l'arpégiateur et l'auto
 * harmonize — non pilotables en MIDI sur ce piano (voir datamining/README.md §1-3), affichés
 * uniquement pour que l'utilisateur sache quoi régler à la main.
 *
 * N'envoie encore aucun message MIDI (Étape 3 de fonctions.md) : les callbacks onToneSelect/
 * onReverbChange/onChorusChange exposés ici serviront de point de branchement à l'Étape 4.
 *
 * @param {HTMLElement} toggleBtn
 * @param {HTMLElement} panel
 * @returns {{ open: () => void, close: () => void, toggle: () => void,
 *   onToneSelect: (cb: (tone: import('../data/tones.js').Tone) => void) => void,
 *   onReverbChange: (cb: (value: number) => void) => void,
 *   onChorusChange: (cb: (value: number) => void) => void }}
 */
export function mountFunctionsPanel(toggleBtn, panel) {
  const searchInput = panel.querySelector('#functions-tone-search');
  const toneSelect = panel.querySelector('#functions-tone-select');
  const toneSelectedEl = panel.querySelector('#functions-tone-selected');
  const reverbSelect = panel.querySelector('#functions-reverb');
  const chorusSelect = panel.querySelector('#functions-chorus');
  const arpeggioListEl = panel.querySelector('#functions-arpeggio-list');
  const harmonizeListEl = panel.querySelector('#functions-harmonize-list');
  const closeBtn = panel.querySelector('#functions-close');

  let onToneSelectCb = null;
  let onReverbChangeCb = null;
  let onChorusChangeCb = null;

  populateTones();
  populateEffects();
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

  function populateEffects() {
    for (const { value, name } of REVERB_TYPES) {
      reverbSelect.appendChild(new Option(name, String(value)));
    }
    for (const { value, name } of CHORUS_TYPES) {
      chorusSelect.appendChild(new Option(name, String(value)));
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
      `${tone.name} (${tone.category} · Program Change ${tone.programChange} · ` +
      `Bank Select MSB ${tone.bankSelectMSB})`;
    onToneSelectCb?.(tone);
  });

  reverbSelect.addEventListener('change', () => onReverbChangeCb?.(Number(reverbSelect.value)));
  chorusSelect.addEventListener('change', () => onChorusChangeCb?.(Number(chorusSelect.value)));

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

  return {
    open,
    close,
    toggle,
    onToneSelect(cb) { onToneSelectCb = cb; },
    onReverbChange(cb) { onReverbChangeCb = cb; },
    onChorusChange(cb) { onChorusChangeCb = cb; },
  };
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
