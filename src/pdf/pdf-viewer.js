import { getDocument } from './pdf-loader.js';
import { locatePoint } from './pdf-geometry.js';

const RENDER_MARGIN_PAGES = 1;
const MAX_CANVAS_SIDE = 4096;
const USER_SCROLLING_TIMEOUT_MS = 4000;
const MIN_SCALE = 0.08;
const MAX_SCALE = 4;
const FIT_WIDTH_MARGIN = 0.96;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Rendu d'un PDF en colonne verticale continue, avec virtualisation des pages
 * (seules les pages visibles ± RENDER_MARGIN_PAGES gardent un canvas peuplé).
 */
export class PdfViewer {
  /**
   * @param {HTMLElement} container
   * @param {{ userScrollingTimeoutMs?: number, defaultZoom?: number|null }} [opts]
   */
  constructor(container, opts = {}) {
    this.container = container;
    this.container.classList.add('pdf-viewer');

    /** @type {import('pdfjs-dist').PDFDocumentProxy | null} */
    this.pdfDoc = null;
    this.pages = [];
    this.scale = 1;
    this._userScrollingTimeoutMs = opts.userScrollingTimeoutMs ?? USER_SCROLLING_TIMEOUT_MS;
    this._defaultZoom = opts.defaultZoom ?? null;

    this._programmaticScroll = false;
    this._programmaticScrollTimer = null;
    this._userScrollingUntil = 0;
    this._scrollRaf = null;
    this._zoomRaf = null;
    this._pendingZoomScale = null;
    this._pinch = null;

    this._onScroll = this._onScroll.bind(this);
    this._onUserGesture = this._onUserGesture.bind(this);
    this._onTouchStart = this._onTouchStart.bind(this);
    this._onTouchMove = this._onTouchMove.bind(this);
    this._onTouchEnd = this._onTouchEnd.bind(this);
    this._onScrollEnd = this._onScrollEnd.bind(this);

    container.addEventListener('scroll', this._onScroll, { passive: true });
    container.addEventListener('wheel', this._onUserGesture, { passive: true });
    container.addEventListener('touchstart', this._onUserGesture, { passive: true });
    container.addEventListener('touchstart', this._onTouchStart, { passive: true });
    container.addEventListener('touchmove', this._onTouchMove, { passive: true });
    container.addEventListener('touchend', this._onTouchEnd, { passive: true });

    this._resizeObserver = new ResizeObserver(() => this._updateVisiblePages());
    this._resizeObserver.observe(container);
  }

  /**
   * Met à jour les réglages consultés par `load()`/les gestes utilisateur, sans recréer le
   * viewer (utile quand on rouvre un morceau différent avec sa propre surcharge de réglages).
   * @param {{ userScrollingTimeoutMs?: number, defaultZoom?: number|null }} opts
   */
  configure(opts = {}) {
    if (opts.userScrollingTimeoutMs !== undefined) this._userScrollingTimeoutMs = opts.userScrollingTimeoutMs;
    if (opts.defaultZoom !== undefined) this._defaultZoom = opts.defaultZoom;
  }

  /**
   * @param {Blob} blob
   * @returns {Promise<{ pageCount:number }>}
   */
  async load(blob) {
    this._clearPages();
    this.pdfDoc?.destroy();

    const buf = await blob.arrayBuffer();
    this.pdfDoc = await getDocument(buf);
    const pageCount = this.pdfDoc.numPages;

    const firstPage = await this.pdfDoc.getPage(1);
    this.scale =
      this._defaultZoom && this._defaultZoom > 0
        ? clamp(this._defaultZoom, MIN_SCALE, MAX_SCALE)
        : this._computeFitWidthScale(firstPage);

    for (let i = 1; i <= pageCount; i++) {
      const page = i === 1 ? firstPage : await this.pdfDoc.getPage(i);
      const viewport = page.getViewport({ scale: this.scale });

      const div = document.createElement('div');
      div.className = 'pdf-page';
      div.style.width = `${viewport.width}px`;
      div.style.height = `${viewport.height}px`;

      const canvas = document.createElement('canvas');
      div.appendChild(canvas);
      this.container.appendChild(div);

      this.pages.push({ index: i, page, viewport, div, canvas, rendered: false, renderTask: null });
    }

    this._updateVisiblePages();
    return { pageCount };
  }

  /**
   * @param {number} page 1-based
   * @param {number} yRatio 0..1
   * @param {{ smooth?: boolean }} [opts]
   */
  scrollToAnchor(page, yRatio, { smooth = true } = {}) {
    const entry = this.pages[page - 1];
    if (!entry) return;

    const top = entry.div.offsetTop + clamp(yRatio, 0, 1) * entry.div.offsetHeight;
    this._programmaticScroll = true;
    this.container.scrollTo({ top, behavior: smooth ? 'smooth' : 'auto' });

    clearTimeout(this._programmaticScrollTimer);
    if ('onscrollend' in this.container) {
      this.container.addEventListener('scrollend', this._onScrollEnd, { once: true });
    } else {
      // Le scroll programmatique émet aussi des événements 'scroll', qu'il ne faut pas
      // confondre avec un scroll utilisateur — d'où ce drapeau temporisé.
      this._programmaticScrollTimer = setTimeout(this._onScrollEnd, smooth ? 500 : 50);
    }
  }

  /**
   * @param {number} clientX
   * @param {number} clientY
   * @returns {{ page:number, yRatio:number } | null}
   */
  hitTest(clientX, clientY) {
    const rect = this.container.getBoundingClientRect();
    const y = clientY - rect.top + this.container.scrollTop;
    const boxes = this.pages.map((entry) => ({
      index: entry.index,
      top: entry.div.offsetTop,
      height: entry.div.offsetHeight,
    }));
    return locatePoint(boxes, y);
  }

  /**
   * Échelle initiale : la page tient dans la largeur du conteneur (moins une petite marge),
   * au lieu de l'échelle native du PDF qui déborde souvent sur mobile/tablette.
   * @param {import('pdfjs-dist').PDFPageProxy} page
   */
  _computeFitWidthScale(page) {
    const nativeWidth = page.getViewport({ scale: 1 }).width;
    const available = this.container.clientWidth || nativeWidth;
    const fit = (available * FIT_WIDTH_MARGIN) / nativeWidth;
    return clamp(fit, MIN_SCALE, MAX_SCALE);
  }

  /** @param {number} scale */
  setZoom(scale) {
    this.scale = clamp(scale, MIN_SCALE, MAX_SCALE);
    for (const entry of this.pages) {
      entry.viewport = entry.page.getViewport({ scale: this.scale });
      entry.div.style.width = `${entry.viewport.width}px`;
      entry.div.style.height = `${entry.viewport.height}px`;
      this._freePage(entry);
    }
    this._updateVisiblePages();
  }

  destroy() {
    this.container.removeEventListener('scroll', this._onScroll);
    this.container.removeEventListener('wheel', this._onUserGesture);
    this.container.removeEventListener('touchstart', this._onUserGesture);
    this.container.removeEventListener('touchstart', this._onTouchStart);
    this.container.removeEventListener('touchmove', this._onTouchMove);
    this.container.removeEventListener('touchend', this._onTouchEnd);
    this.container.removeEventListener('scrollend', this._onScrollEnd);
    clearTimeout(this._programmaticScrollTimer);
    this._resizeObserver.disconnect();
    this._clearPages();
    this.pdfDoc?.destroy();
    this.pdfDoc = null;
  }

  /** true si l'utilisateur a scrollé/touché/molette dans les `userScrollingTimeoutMs` dernières ms. */
  get userScrolling() {
    return Date.now() < this._userScrollingUntil;
  }

  _onScrollEnd() {
    this._programmaticScroll = false;
  }

  _onUserGesture() {
    if (!this._programmaticScroll) {
      this._userScrollingUntil = Date.now() + this._userScrollingTimeoutMs;
    }
  }

  _onScroll() {
    if (this._scrollRaf) return;
    this._scrollRaf = requestAnimationFrame(() => {
      this._scrollRaf = null;
      this._updateVisiblePages();
    });
  }

  _onTouchStart(e) {
    if (e.touches.length === 2) {
      this._pinch = { startDistance: this._touchDistance(e.touches), startScale: this.scale };
    }
  }

  _onTouchMove(e) {
    if (e.touches.length === 2 && this._pinch) {
      const ratio = this._touchDistance(e.touches) / this._pinch.startDistance;
      this._scheduleZoom(this._pinch.startScale * ratio);
    }
  }

  _onTouchEnd(e) {
    if (e.touches.length < 2) {
      this._pinch = null;
    }
  }

  _touchDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
  }

  _scheduleZoom(scale) {
    this._pendingZoomScale = scale;
    if (this._zoomRaf) return;
    this._zoomRaf = requestAnimationFrame(() => {
      this._zoomRaf = null;
      this.setZoom(this._pendingZoomScale);
    });
  }

  _updateVisiblePages() {
    if (this.pages.length === 0) return;

    const viewTop = this.container.scrollTop;
    const viewBottom = viewTop + this.container.clientHeight;
    let first = null;
    let last = null;

    this.pages.forEach((entry, i) => {
      const top = entry.div.offsetTop;
      const bottom = top + entry.div.offsetHeight;
      if (bottom >= viewTop && top <= viewBottom) {
        if (first === null) first = i;
        last = i;
      }
    });

    if (first === null) return;
    const start = Math.max(0, first - RENDER_MARGIN_PAGES);
    const end = Math.min(this.pages.length - 1, last + RENDER_MARGIN_PAGES);

    this.pages.forEach((entry, i) => {
      if (i >= start && i <= end) {
        this._renderPage(entry);
      } else {
        this._freePage(entry);
      }
    });
  }

  async _renderPage(entry) {
    if (entry.rendered || entry.renderTask) return;

    // Résolution : scale * min(devicePixelRatio, 2), canvas plafonné à MAX_CANVAS_SIDE —
    // indispensable pour la mémoire sur Android (un PDF de plusieurs pages en pleine
    // résolution DPR peut faire planter l'onglet sans cette limite).
    const outputScale = Math.min(window.devicePixelRatio || 1, 2);
    let pixelWidth = Math.floor(entry.viewport.width * outputScale);
    let pixelHeight = Math.floor(entry.viewport.height * outputScale);
    const largestSide = Math.max(pixelWidth, pixelHeight);
    if (largestSide > MAX_CANVAS_SIDE) {
      const capRatio = MAX_CANVAS_SIDE / largestSide;
      pixelWidth = Math.floor(pixelWidth * capRatio);
      pixelHeight = Math.floor(pixelHeight * capRatio);
    }

    const { canvas } = entry;
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
    canvas.style.width = `${entry.viewport.width}px`;
    canvas.style.height = `${entry.viewport.height}px`;

    const ctx = canvas.getContext('2d');
    const transform = [
      pixelWidth / entry.viewport.width,
      0,
      0,
      pixelHeight / entry.viewport.height,
      0,
      0,
    ];

    const task = entry.page.render({ canvasContext: ctx, viewport: entry.viewport, transform });
    entry.renderTask = task;
    try {
      await task.promise;
      entry.rendered = true;
    } catch (err) {
      if (err?.name !== 'RenderingCancelledException') throw err;
    } finally {
      if (entry.renderTask === task) entry.renderTask = null;
    }
  }

  _freePage(entry) {
    if (entry.renderTask) {
      entry.renderTask.cancel();
      entry.renderTask = null;
    }
    entry.canvas.width = 0;
    entry.canvas.height = 0;
    entry.rendered = false;
  }

  _clearPages() {
    for (const entry of this.pages) {
      this._freePage(entry);
      entry.div.remove();
    }
    this.pages = [];
  }
}
