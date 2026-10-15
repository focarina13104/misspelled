import './styles.css';
import { createWordClient } from './client.js';
import { loadLocale, saveLocale } from './i18n.js';
import { mountUI } from './ui.js';

let storage;
try { storage = window.localStorage; } catch { /* The interface works without storage. */ }
let locale = loadLocale(storage, navigator.languages || [navigator.language]);
let view;
const client = createWordClient({
  workerFactory: () => new Worker(new URL('./worker.js', import.meta.url), { type: 'module' }),
  onChange: () => view?.render(),
});
view = mountUI(document.querySelector('#app'), {
  client,
  storage,
  getLocale: () => locale,
  setLocale(value) { locale = value; saveLocale(storage, locale); },
});
view.render();
