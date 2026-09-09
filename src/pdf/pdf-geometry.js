/**
 * @typedef {Object} PageBox
 * @property {number} index   numéro de page, 1-based
 * @property {number} top     offset vertical dans le référentiel du conteneur (px)
 * @property {number} height  hauteur de la page à l'échelle courante (px)
 */

/**
 * Fonction pure : trouve la page sous une coordonnée verticale donnée (référentiel du
 * conteneur, scroll inclus) et la position normalisée dans cette page.
 * @param {PageBox[]} pages  pages triées par ordre croissant de `top`
 * @param {number} y
 * @returns {{ page:number, yRatio:number } | null}
 */
export function locatePoint(pages, y) {
  for (const box of pages) {
    const bottom = box.top + box.height;
    if (y >= box.top && y <= bottom) {
      return { page: box.index, yRatio: box.height > 0 ? (y - box.top) / box.height : 0 };
    }
  }
  return null;
}
