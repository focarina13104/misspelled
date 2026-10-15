const storageKey = 'misspelled.extraLetterStyle';
const supportedStyles = ['highlight', 'strike'];

export function loadExtraLetterStyle(storage) {
  try {
    const saved = storage?.getItem(storageKey);
    if (supportedStyles.includes(saved)) return saved;
  } catch { /* Display preferences are optional. */ }
  return 'highlight';
}

export function saveExtraLetterStyle(storage, style) {
  if (!supportedStyles.includes(style)) return;
  try { storage?.setItem(storageKey, style); } catch { /* Keep the preference for this session. */ }
}
