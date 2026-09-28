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
      ],
    }),
  ],
  build: {
    chunkSizeWarningLimit: 6000,
    target: 'es2022',
    // Two independent apps: the flight simulator (/) and the ECG physiology lab (/ecg/).
    rolldownOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        ecg: resolve(import.meta.dirname, 'ecg/index.html'),
      },
    },
  },
  server: { host: true },
});
