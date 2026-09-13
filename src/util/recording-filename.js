/**
 * Nom de fichier `.mid` horodaté pour une prise exportée depuis l'enregistreur (Phase B) —
 * partagé entre le téléchargement classique (Étape B3) et l'explorateur de fichiers (Étape B4)
 * pour garder un nommage cohérent quel que soit le chemin de sauvegarde choisi.
 * @returns {string}
 */
export function recordingFilename() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `piano-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.mid`;
}
