import { validateWord } from './word.js';

// Optimal string alignment: an adjacent swapped pair counts as one edit.
export function editDistance(a, b, limit) {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  let beforePrevious;
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(previous[j] + 1, row[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        row[j] = Math.min(row[j], beforePrevious[j - 2] + 1);
      }
    }
    beforePrevious = previous;
    previous = row;
  }
  return previous[b.length];
}

export function createSimilarSearch(dictionaryTexts, isCorrect) {
  const buckets = new Map();
  const seen = new Set();
  for (const text of dictionaryTexts) {
    for (const line of text.split(/\r?\n/)) {
      const entry = line.split(/[\/\s]/, 1)[0];
      const parsed = validateWord(entry);
      if (!parsed.ok || !isCorrect(parsed.normalized)) continue;
      const key = parsed.normalized.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      if (!buckets.has(key.length)) buckets.set(key.length, []);
      buckets.get(key.length).push({ word: parsed.normalized, key });
    }
  }

  function find(input) {
    const parsed = validateWord(input);
    if (!parsed.ok) return parsed;
    const query = parsed.normalized.toLowerCase();
    const limit = query.length <= 4 ? 1 : 2;
    const matches = [];
    for (let length = Math.max(1, query.length - limit); length <= query.length + limit; length++) {
      for (const entry of buckets.get(length) || []) {
        if (entry.key === query) continue;
        const distance = editDistance(query, entry.key, limit);
        if (distance <= limit) matches.push({ ...entry, distance });
      }
    }
    matches.sort((a, b) => a.distance - b.distance || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
    return {
      ok: true, word: parsed.word, correct: isCorrect(parsed.normalized),
      suggestions: matches.slice(0, 5).map(entry => entry.key),
    };
  }
  return { find };
}
