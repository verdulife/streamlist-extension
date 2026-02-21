import { mount } from 'svelte';
import App from './App.svelte';

console.log('🎬 Svelte Popup initializing...');

const app = mount(App, {
  target: document.getElementById('app')
});

export default app;