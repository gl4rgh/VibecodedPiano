import { Recorder } from '../core/recorder.js';

const ICON_RECORD =
  '<svg width="16" height="16" viewBox="0 0 256 256" fill="currentColor"><circle cx="128" cy="128" r="80"/></svg>';
const ICON_PAUSE =
  '<svg width="16" height="16" viewBox="0 0 256 256" fill="currentColor"><path d="M200,32H160a16,16,0,0,0-16,16V208a16,16,0,0,0,16,16h40a16,16,0,0,0,16-16V48A16,16,0,0,0,200,32Zm0,176H160V48h40ZM96,32H56A16,16,0,0,0,40,48V208a16,16,0,0,0,16,16H96a16,16,0,0,0,16-16V48A16,16,0,0,0,96,32Zm0,176H56V48H96Z"/></svg>';
const ICON_PLAY =
  '<svg width="16" height="16" viewBox="0 0 256 256" fill="currentColor"><path d="M232.4,114.49,88.32,26.35a16,16,0,0,0-16.2-.3A15.86,15.86,0,0,0,64,39.87V216.13A15.94,15.94,0,0,0,80,232a16.07,16.07,0,0,0,8.36-2.35L232.4,141.51a15.81,15.81,0,0,0,0-27ZM80,215.94V40l143.83,88Z"/></svg>';

const STATUS_LABELS = {
  idle: 'Prêt à enregistrer',
  recording: 'Enregistrement…',
  paused: 'Enregistrement en pause',
  stopped: 'Enregistrement arrêté',
};

/**
 * Boutons Record/Pause/Stop de l'enregistreur intégré (fonctions.md Phase B, Étape B2). Relaie
 * les events `noteon`/`noteoff` de `midiInput` (src/core/midi-input.js) vers un `Recorder`
 * (src/core/recorder.js) et reflète son état idle/recording/paused/stopped visuellement (pastille
 * + libellé, même principe que `.hud-midi-dot`). Pas de sauvegarde ici — voir Étape B3.
 * @param {HTMLElement} container  doit contenir #record-start/#record-pause/#record-stop/#record-dot/#record-label
 * @param {import('../core/midi-input.js').MidiInput} midiInput
 * @returns {{ getRecorder: () => Recorder }}
 */
export function mountRecorderControls(container, midiInput) {
  const startBtn = container.querySelector('#record-start');
  const pauseBtn = container.querySelector('#record-pause');
  const stopBtn = container.querySelector('#record-stop');
  const dotEl = container.querySelector('#record-dot');
  const labelEl = container.querySelector('#record-label');

  const recorder = new Recorder();

  midiInput.addEventListener('noteon', (e) => recorder.noteOn(e.detail.pitch, e.detail.velocity));
  midiInput.addEventListener('noteoff', (e) => recorder.noteOff(e.detail.pitch));

  startBtn.addEventListener('click', () => {
    recorder.start();
    refresh();
  });

  pauseBtn.addEventListener('click', () => {
    if (recorder.state === 'paused') recorder.resume();
    else recorder.pause();
    refresh();
  });

  stopBtn.addEventListener('click', () => {
    recorder.stop();
    refresh();
  });

  function refresh() {
    const state = recorder.state;
    const active = state === 'recording' || state === 'paused';

    dotEl.dataset.status = state;
    labelEl.textContent = STATUS_LABELS[state];

    startBtn.hidden = active;
    startBtn.innerHTML = `${ICON_RECORD}<span class="btn-label">${
      state === 'stopped' ? 'Nouvel enregistrement' : 'Enregistrer'
    }</span>`;

    pauseBtn.hidden = !active;
    pauseBtn.innerHTML =
      state === 'paused'
        ? `${ICON_PLAY}<span class="btn-label">Reprendre</span>`
        : `${ICON_PAUSE}<span class="btn-label">Pause</span>`;

    stopBtn.hidden = !active;
  }

  refresh();

  return { getRecorder: () => recorder };
}
