import nspell from 'nspell';
import { validateWord } from './word.js';

export function createSpellService(dictionaries) {
  if (!dictionaries.length) throw new Error('Missing dictionary data');
  for (const { aff, dic } of dictionaries) {
    const lines = typeof dic === 'string' ? dic.trim().split(/\r?\n/) : [];
    if (typeof aff !== 'string' || !/^SET[ \t]+UTF-8[ \t]*\r?$/m.test(aff) ||
        !/^\d+$/.test(lines[0] || '') || Number(lines[0]) < 1 || Number(lines[0]) !== lines.length - 1) {
      throw new Error('Invalid or incomplete English dictionary data');
    }
  }
  const checkers = dictionaries.map(dictionary => nspell(dictionary));
  const correct = word => {
    const normalized = word.replaceAll('’', "'");
    const lower = normalized.toLowerCase();
    const forms = new Set([normalized, lower, lower[0]?.toUpperCase() + lower.slice(1), normalized.toUpperCase()]);
    return checkers.some(checker => [...forms].some(form => checker.correct(form)));
  };

  function check(input) {
    const parsed = validateWord(input);
    if (!parsed.ok) return parsed;
    const { word, normalized } = parsed;
    const accepted = correct(normalized);
    const suggestions = [];
    const seen = new Set();
    if (!accepted) {
      for (const checker of checkers) {
        for (const candidate of checker.suggest(normalized)) {
          if (!validateWord(candidate).ok || !correct(candidate)) continue;
          const key = candidate.toLowerCase();
          if (key === normalized.toLowerCase() || seen.has(key)) continue;
          seen.add(key);
          suggestions.push(key);
          if (suggestions.length === 5) break;
        }
        if (suggestions.length === 5) break;
      }
    }
    return { ok: true, word, correct: accepted, suggestions };
  }
  return { correct, check };
}
