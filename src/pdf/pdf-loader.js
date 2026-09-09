import { GlobalWorkerOptions, getDocument as pdfjsGetDocument } from 'pdfjs-dist';

// Piège plan.md §8.2 : chemin du worker calculé via import.meta.url, jamais en dur —
// un chemin figé casse au build Vite.
GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

/**
 * Charge un document PDF depuis un buffer.
 * @param {ArrayBuffer} data
 * @returns {Promise<import('pdfjs-dist').PDFDocumentProxy>}
 */
export function getDocument(data) {
  return pdfjsGetDocument({ data }).promise;
}
