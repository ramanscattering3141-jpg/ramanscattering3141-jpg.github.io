import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

// Cesium ships web workers, shaders and assets that must be served as static
// files; CESIUM_BASE_URL tells the library where to find them.
const cesiumSource = 'node_modules/cesium/Build/Cesium';
const cesiumBaseUrl = 'cesium';

export default defineConfig({
  base: './',
  define: { CESIUM_BASE_URL: JSON.stringify(cesiumBaseUrl) },
  plugins: [
    viteStaticCopy({
      targets: [
        { src: `${cesiumSource}/ThirdParty`, dest: cesiumBaseUrl, rename: { stripBase: 4 } },
        { src: `${cesiumSource}/Workers`, dest: cesiumBaseUrl, rename: { stripBase: 4 } },
        { src: `${cesiumSource}/Assets`, dest: cesiumBaseUrl, rename: { stripBase: 4 } },
        { src: `${cesiumSource}/Widgets`, dest: cesiumBaseUrl, rename: { stripBase: 4 } },
        // Chess book reader: engine, OCR and PDF data files, self-hosted (no CDN at run time).
        ...['lite-single', 'lite', 'single'].flatMap((f) => [`stockfish-19-${f}.js`, `stockfish-19-${f}.wasm`]).map((f) => (
          { src: `node_modules/stockfish/bin/${f}`, dest: 'chess-vendor/stockfish', rename: { stripBase: true } })),
        { src: 'node_modules/stockfish/Copying.txt', dest: 'chess-vendor/stockfish', rename: { stripBase: true } },
        { src: 'node_modules/tesseract.js/dist/worker.min.js', dest: 'chess-vendor/tesseract', rename: { stripBase: true } },
        ...['', 'simd-', 'relaxedsimd-'].map((v) => (
          { src: `node_modules/tesseract.js-core/tesseract-core-${v}lstm.wasm.js`, dest: 'chess-vendor/tesseract', rename: { stripBase: true } })),
        { src: 'node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz', dest: 'chess-vendor/tesseract/lang', rename: { stripBase: true } },
        { src: 'node_modules/pdfjs-dist/cmaps', dest: 'chess-vendor/pdfjs', rename: { stripBase: 2 } },
        { src: 'node_modules/pdfjs-dist/standard_fonts', dest: 'chess-vendor/pdfjs', rename: { stripBase: 2 } },
        { src: 'src/chess/sw.js', dest: '.', rename: { name: 'chess-sw.js', stripBase: true } },
      ],
    }),
  ],
  oxc: { jsx: { runtime: 'automatic', importSource: 'preact' } },
  build: {
    chunkSizeWarningLimit: 6000,
    target: 'es2022',
    // Independent apps: the flight simulator (/), the ECG lab (/ecg/), the renal lab (/renal/) and the chess book reader (/chess/).
    rolldownOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        ecg: resolve(import.meta.dirname, 'ecg/index.html'),
        renal: resolve(import.meta.dirname, 'renal/index.html'),
        chess: resolve(import.meta.dirname, 'chess/index.html'),
      },
    },
  },
  server: { host: true },
});
