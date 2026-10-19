import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    port: 5175,
    open: false,
    host: true,
  },
  build: {
    target: 'esnext',
  },
});
