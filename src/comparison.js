// Align the original word with a suggestion; preserve the typed characters.
export function compareWord(source, target, { separateDeletions = false } = {}) {
  const original = Array.from(source);
  const replacement = Array.from(target);
  const normalize = letter => letter.toLowerCase().replace('’', "'");
  const a = original.map(normalize);
  const b = replacement.map(normalize);
  const cost = Array.from({ length: a.length + 1 }, () => new Uint16Array(b.length + 1));
  for (let i = 0; i <= a.length; i++) cost[i][0] = i;
  for (let j = 0; j <= b.length; j++) cost[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      cost[i][j] = Math.min(cost[i - 1][j] + 1, cost[i][j - 1] + 1, cost[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        cost[i][j] = Math.min(cost[i][j], cost[i - 2][j - 2] + 1);
      }
    }
  }
  const reversed = [];
  let i = a.length;
  let j = b.length;
  while (i || j) {
    // On an equal-cost repeated-letter match, keep the earlier copy unchanged.
    if (i > 1 && j && a[i - 1] === a[i - 2] && a[i - 1] === b[j - 1] && cost[i][j] === cost[i - 1][j] + 1) {
      reversed.push({ type: 'changed', text: original[--i], expected: '' });
    } else if (i && j && a[i - 1] === b[j - 1] && cost[i][j] === cost[i - 1][j - 1]) {
      reversed.push({ type: 'same', text: original[--i] });
      j--;
    } else if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1] && cost[i][j] === cost[i - 2][j - 2] + 1) {
      reversed.push({ type: 'changed', text: original[i - 1], expected: replacement[j - 1] }, { type: 'changed', text: original[i - 2], expected: replacement[j - 2] });
      i -= 2;
      j -= 2;
    } else if (i && j && cost[i][j] === cost[i - 1][j - 1] + 1) {
      reversed.push({ type: 'changed', text: original[--i], expected: replacement[--j] });
    } else if (i && cost[i][j] === cost[i - 1][j] + 1) {
      reversed.push({ type: 'changed', text: original[--i], expected: '' });
    } else {
      reversed.push({ type: 'gap', text: '', expected: replacement[--j] });
    }
  }
  const parts = [];
  for (const part of reversed.reverse()) {
    const previous = parts.at(-1);
    const canMergeDeletion = !separateDeletions || (previous?.type === 'changed' && !previous.expected) === (part.type === 'changed' && !part.expected);
    if (previous && canMergeDeletion && (previous.type === part.type || (previous.type !== 'same' && part.type !== 'same'))) {
      previous.text += part.text;
      if (part.type !== 'same') {
        previous.expected += part.expected;
        previous.type = previous.text ? 'changed' : 'gap';
      }
    } else parts.push({ ...part });
  }
  return parts;
}
