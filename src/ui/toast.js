const ICON_RELOAD =
  '<svg width="14" height="14" viewBox="0 0 256 256" fill="currentColor"><path d="M240,56v48a8,8,0,0,1-8,8H184a8,8,0,0,1,0-16H211.4L184.81,71.64l-.25-.24a80,80,0,1,0-1.67,114.78,8,8,0,0,1,11,11.63A95.44,95.44,0,0,1,128,224h-1.32A96,96,0,1,1,195.75,60L224,85.8V56a8,8,0,1,1,16,0Z"/></svg>';
const ICON_X =
  '<svg width="14" height="14" viewBox="0 0 256 256" fill="currentColor"><path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z"/></svg>';

/**
 * Bandeau de notification persistant (pas d'auto-disparition : un message ignoré doit rester
 * visible plutôt que disparaître sans qu'on l'ait vu). Utilisé pour signaler qu'une nouvelle
 * version de l'app est disponible ; réutilisable pour d'autres notifications au besoin.
 * @param {string} message
 * @param {{ actionLabel?: string, onAction?: () => void }} [opts]
 * @returns {HTMLElement} le bandeau créé (pour le retirer soi-même si besoin)
 */
export function showBanner(message, opts = {}) {
  const el = document.createElement('div');
  el.className = 'toast-banner';

  const messageEl = document.createElement('span');
  messageEl.className = 'toast-message';
  messageEl.textContent = message;
  el.appendChild(messageEl);

  if (opts.actionLabel) {
    const actionBtn = document.createElement('button');
    actionBtn.type = 'button';
    actionBtn.className = 'toast-action';
    const iconSpan = document.createElement('span');
    iconSpan.innerHTML = ICON_RELOAD;
    const labelSpan = document.createElement('span');
    labelSpan.textContent = opts.actionLabel;
    actionBtn.append(iconSpan, labelSpan);
    actionBtn.addEventListener('click', () => opts.onAction?.());
    el.appendChild(actionBtn);
  }

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'toast-close';
  closeBtn.setAttribute('aria-label', 'Fermer');
  closeBtn.innerHTML = ICON_X;
  closeBtn.addEventListener('click', () => el.remove());
  el.appendChild(closeBtn);

  document.body.appendChild(el);
  return el;
}
