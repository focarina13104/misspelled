export function validateWord(input) {
  if (typeof input !== 'string') return { ok: false, errorCode: 'invalidWord' };
  const word = input.trim();
  if (!word) return { ok: false, errorCode: 'empty' };
  if (/\s/.test(word)) return { ok: false, errorCode: 'oneWord' };
  if (word.length > 100) return { ok: false, errorCode: 'tooLong' };
  if (!/^[a-z]+(?:['’][a-z]+)*$/i.test(word)) return { ok: false, errorCode: 'invalidWord' };
  return { ok: true, word, normalized: word.replaceAll('’', "'") };
}

