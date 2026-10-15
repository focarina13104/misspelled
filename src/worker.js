import { createSpellService } from './spelling.js';
import { createSimilarSearch } from './similar.js';

let spell;
let similar;
self.onmessage = ({ data }) => {
  const { id, mode, input } = data;
  try {
    if (!spell || !similar || !['check', 'similar'].includes(mode)) throw new Error('Not ready');
    const result = mode === 'check' ? spell.check(input) : similar.find(input);
    self.postMessage({ id, mode, result });
  } catch {
    self.postMessage({ id, mode, errorCode: 'operationFailed' });
  }
};

try {
  const dictionaries = await Promise.all(['en', 'en-GB'].map(async locale => {
    const [aff, dic] = await Promise.all(['aff', 'dic'].map(async extension => {
      const response = await fetch(`${import.meta.env.BASE_URL}dictionaries/${locale}/index.${extension}`);
      if (!response.ok) throw new Error('Dictionary unavailable');
      return response.text();
    }));
    return { aff, dic };
  }));
  spell = createSpellService(dictionaries);
  similar = createSimilarSearch(dictionaries.map(dictionary => dictionary.dic), spell.correct);
  self.postMessage({ type: 'ready' });
} catch {
  self.postMessage({ type: 'initError' });
}
