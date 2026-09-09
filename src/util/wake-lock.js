/**
 * Empêche l'écran de s'éteindre en mode jeu (`navigator.wakeLock.request('screen')`).
 * Un wake lock est relâché automatiquement par le navigateur dès que l'onglet perd la
 * visibilité (verrouillage tablette, changement d'app) — il faut donc le redemander sur
 * `visibilitychange` plutôt que supposer qu'il reste actif après un retour au premier plan.
 * Silencieux si l'API est absente ou la demande refusée (batterie faible, etc.) : ce n'est
 * jamais bloquant pour le mode jeu.
 */
export class ScreenWakeLock {
  constructor() {
    this._sentinel = null;
    this._active = false;
    this._onVisibilityChange = this._onVisibilityChange.bind(this);
  }

  /** À appeler à l'entrée du mode jeu. */
  async enable() {
    if (this._active) return;
    this._active = true;
    document.addEventListener('visibilitychange', this._onVisibilityChange);
    await this._request();
  }

  /** À appeler à la sortie du mode jeu. */
  async disable() {
    this._active = false;
    document.removeEventListener('visibilitychange', this._onVisibilityChange);
    await this._release();
  }

  async _request() {
    if (!this._active || typeof navigator === 'undefined' || !navigator.wakeLock) return;
    if (document.visibilityState !== 'visible') return;
    try {
      this._sentinel = await navigator.wakeLock.request('screen');
    } catch {
      this._sentinel = null;
    }
  }

  async _release() {
    try {
      await this._sentinel?.release();
    } catch {
      // déjà relâché (l'onglet a perdu la visibilité entre-temps) : rien à faire.
    }
    this._sentinel = null;
  }

  _onVisibilityChange() {
    if (document.visibilityState === 'visible') {
      this._request();
    }
  }
}
