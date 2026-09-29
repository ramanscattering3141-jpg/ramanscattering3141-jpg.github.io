import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { resolve } from 'node:path';

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
      ],
    }),
  ],
  esbuild: { jsx: 'automatic', jsxImportSource: 'preact' },
  build: {
    chunkSizeWarningLimit: 6000,
    target: 'es2022',
    // Two independent apps share this site: the flight simulator at the root and
    // the renal physiology laboratory under /renal/.
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        renal: resolve(__dirname, 'renal/index.html'),
      },
    },
  },
  server: { host: true },
});
