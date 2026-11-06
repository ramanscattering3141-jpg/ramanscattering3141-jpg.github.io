// Where self-hosted third-party files live. The chess app is served from /chess/ and the
// vendored files (Stockfish, Tesseract, pdf.js worker) from /chess-vendor/ next to it.
export function vendorUrl(path: string): string {
  const base = typeof document !== 'undefined' ? document.baseURI : 'http://localhost/chess/';
  return new URL(`../chess-vendor/${path}`, base).href;
}
