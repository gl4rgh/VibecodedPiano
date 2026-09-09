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
    actionBtn.textContent = opts.actionLabel;
    actionBtn.addEventListener('click', () => opts.onAction?.());
    el.appendChild(actionBtn);
  }

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'toast-close';
  closeBtn.setAttribute('aria-label', 'Fermer');
  closeBtn.textContent = '✕';
  closeBtn.addEventListener('click', () => el.remove());
  el.appendChild(closeBtn);

  document.body.appendChild(el);
  return el;
}
