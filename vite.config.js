import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import manifest from './manifest.json';

export default defineConfig({
  plugins: [
    svelte(),
    tailwindcss(),
    crx({ manifest })
  ],
  build: {
    rollupOptions: {
      input: {
        popup: 'src/popup/popup.html',
        playlist: 'src/playlist/playlist.html'
      }
    }
  }
});