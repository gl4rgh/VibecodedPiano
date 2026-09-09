/**
 * @typedef {Object} Anchor
 * @property {string} id
 * @property {number} eventIndex   index du RefEvent déclencheur
 * @property {number} page         1-based
 * @property {number} yRatio       0..1, position verticale dans la page
 * @property {string} label        libre, ex. "p2 système 3"
 * @property {number} [lead]       surcharge du pré-roll pour cette ancre (en événements)
 */

const SCHEMA_VERSION = 1;

/** Tri stable par eventIndex croissant, sans muter le tableau d'origine. @param {Anchor[]} anchors */
export function sortAnchors(anchors) {
  return [...anchors].sort((a, b) => a.eventIndex - b.eventIndex);
}

/**
 * Dernière ancre (au sens du plus grand eventIndex satisfaisant) dont (eventIndex - lead) <= cursor.
 * null si aucune. Pure et idempotente : ne dépend que de (anchors, cursor, defaultLead).
 * @param {Anchor[]} anchors
 * @param {number} cursor
 * @param {number} defaultLead
 * @returns {Anchor | null}
 */
export function resolveActiveAnchor(anchors, cursor, defaultLead) {
  let active = null;
  for (const anchor of sortAnchors(anchors)) {
    const lead = anchor.lead ?? defaultLead;
    if (anchor.eventIndex - lead <= cursor) active = anchor;
  }
  return active;
}

/** Remplace l'ancre de même id si elle existe, sinon l'ajoute. @returns {Anchor[]} */
export function upsertAnchor(anchors, anchor) {
  const others = anchors.filter((a) => a.id !== anchor.id);
  return sortAnchors([...others, anchor]);
}

/** @returns {Anchor[]} */
export function removeAnchor(anchors, id) {
  return anchors.filter((a) => a.id !== id);
}

/**
 * SHA-256 hexadécimal d'un Blob (utilisé pour détecter un midiBlob différent à l'import).
 * @param {Blob} blob
 * @returns {Promise<string>}
 */
export async function sha256Hex(blob) {
  const buf = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Format d'export JSON partageable. Async : le hash SHA-256 du midiBlob (crypto.subtle) ne
 * peut pas être calculé de façon synchrone.
 * @param {import('./store.js').Piece} piece
 * @returns {Promise<string>}
 */
export async function exportJson(piece) {
  const midiSha256 = await sha256Hex(piece.midiBlob);
  const data = {
    schemaVersion: SCHEMA_VERSION,
    title: piece.title,
    midiSha256,
    pdfPageCount: piece.pageCount,
    eventCount: piece.eventCount,
    settings: piece.settings ?? {},
    anchors: sortAnchors(piece.anchors).map(anchorToJson),
  };
  return JSON.stringify(data, null, 2);
}

function anchorToJson(anchor) {
  const { id, eventIndex, page, yRatio, label, lead } = anchor;
  const json = { id, eventIndex, page, yRatio, label };
  if (lead !== undefined) json.lead = lead;
  return json;
}

/**
 * @param {string} text
 * @param {string} [expectedSha]  midiSha256 du morceau courant, pour avertir en cas de divergence
 * @returns {{ anchors: Anchor[], warnings: string[] }}
 */
export function importJson(text, expectedSha) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('JSON invalide.');
  }

  if (data.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(`schemaVersion non supporté : ${data.schemaVersion}`);
  }
  if (!Array.isArray(data.anchors)) {
    throw new Error('Champ "anchors" manquant ou invalide.');
  }

  const warnings = [];
  if (expectedSha && data.midiSha256 && data.midiSha256 !== expectedSha) {
    warnings.push(
      'Le MIDI de référence a changé depuis cet export : les ancres importées peuvent être décalées.',
    );
  }

  const anchors = data.anchors.map((a) => ({
    id: a.id,
    eventIndex: a.eventIndex,
    page: a.page,
    yRatio: a.yRatio,
    label: a.label,
    ...(a.lead !== undefined ? { lead: a.lead } : {}),
  }));

  return { anchors: sortAnchors(anchors), warnings };
}
