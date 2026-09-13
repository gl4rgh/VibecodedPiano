/**
 * Nom de fichier `.mid` horodaté pour une prise exportée depuis l'enregistreur.
 * @returns {string}
 */
export function recordingFilename() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `piano-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.mid`;
}
