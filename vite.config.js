import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  base: './',
  server: {
    port: 5175,
    open: false,
    host: true,
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        corneringLab: fileURLToPath(new URL('./cornering-lab.html', import.meta.url)),
        trackEditor: fileURLToPath(new URL('./track-editor.html', import.meta.url)),
        decalStudio: fileURLToPath(new URL('./decal-studio.html', import.meta.url)),
        treesGallery: fileURLToPath(new URL('./trees-gallery.html', import.meta.url)),
      },
    },
  },
});
