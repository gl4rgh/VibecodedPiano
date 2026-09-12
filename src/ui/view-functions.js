import { MidiOutput } from '../core/midi-output.js';
import { TONES, TONE_CATEGORIES } from '../data/tones.js';
import { REVERB_TYPES, CHORUS_TYPES } from '../data/effects.js';
import { ARPEGGIATOR_TYPES } from '../data/arpeggiator-types.js';
import { AUTO_HARMONIZE_TYPES } from '../data/auto-harmonize-types.js';

/**
 * Panneau « Fonctionnalités » : connexion à une sortie MIDI, choix du son (envoie Bank Select +
 * Program Change dès la sélection), et des effets Reverb/Chorus (UI prête, envoi MIDI à l'Étape 5
 * de fonctions.md — SysEx Universal Real Time). Tables de référence en lecture seule pour
 * l'arpégiateur et l'auto harmonize — non pilotables en MIDI sur ce piano (voir
 * datamining/README.md §1-3), affichées uniquement pour que l'utilisateur sache quoi régler à la
 * main.
 *
 * @param {HTMLElement} toggleBtn
 * @param {HTMLElement} panel
 * @returns {{ open: () => void, close: () => void, toggle: () => void }}
 */
export function mountFunctionsPanel(toggleBtn, panel) {
  const connectBtn = panel.querySelector('#functions-connect-midi');
  const portSelect = panel.querySelector('#functions-midi-port-select');
  const statusEl = panel.querySelector('#functions-midi-status');
  const channelSelect = panel.querySelector('#functions-midi-channel');
  const searchInput = panel.querySelector('#functions-tone-search');
  const toneSelect = panel.querySelector('#functions-tone-select');
  const toneSelectedEl = panel.querySelector('#functions-tone-selected');
  const reverbSelect = panel.querySelector('#functions-reverb');
  const chorusSelect = panel.querySelector('#functions-chorus');
  const arpeggioListEl = panel.querySelector('#functions-arpeggio-list');
  const harmonizeListEl = panel.querySelector('#functions-harmonize-list');
  const closeBtn = panel.querySelector('#functions-close');

  const midiOutput = new MidiOutput();

  populateChannels();
  populateTones();
  populateEffects();
  populateReferenceLists();

  midiOutput.addEventListener('statechange', (e) => renderPorts(e.detail.outputs));
  midiOutput.addEventListener('error', (e) => console.error('[functions] MIDI', e.detail.message));

  connectBtn.addEventListener('click', async () => {
    connectBtn.disabled = true;
    setMidiStatus('requesting');
    await midiOutput.connect();
    setMidiStatus(midiOutput.status);
    connectBtn.disabled = false;
  });

  portSelect.addEventListener('change', () => {
    midiOutput.selectOutput(portSelect.value || null);
  });

  function setMidiStatus(status) {
    statusEl.textContent = status;
    statusEl.dataset.status = status;
  }

  function renderPorts(outputs) {
    const previousValue = portSelect.value;
    portSelect.innerHTML = '<option value="">Aucun port</option>';
    for (const output of outputs) {
      const option = new Option(`${output.name} (${output.state})`, output.id);
      portSelect.appendChild(option);
    }
    portSelect.value = previousValue;
  }

  function populateChannels() {
    for (let ch = 0; ch < 16; ch++) {
      channelSelect.appendChild(new Option(`Canal ${ch + 1}`, String(ch)));
    }
  }

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

    const channel = Number(channelSelect.value);
    const sent = midiOutput.selectedOutput != null;
    if (sent) {
      midiOutput.bankSelectMSB(channel, tone.bankSelectMSB);
      midiOutput.programChange(channel, tone.programChange);
    }

    toneSelectedEl.textContent =
      `${tone.name} (${tone.category} · Program Change ${tone.programChange} · ` +
      `Bank Select MSB ${tone.bankSelectMSB})` +
      (sent ? ' — envoyé au piano.' : ' — pas envoyé (connecte une sortie MIDI d\'abord).');
  });

  // Reverb/Chorus : UI prête (voir populateEffects), envoi MIDI (SysEx) à l'Étape 5.

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
