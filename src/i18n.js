import en from './locales/en.js';
import zhHK from './locales/zh-HK.js';
import zhTW from './locales/zh-TW.js';
import zhCN from './locales/zh-CN.js';
import ja from './locales/ja.js';
import ko from './locales/ko.js';

export const messages = { en, 'zh-HK': zhHK, 'zh-TW': zhTW, 'zh-CN': zhCN, ja, ko };
export const supportedLocales = [
  { id: 'en', label: 'English' }, { id: 'zh-HK', label: '中文（香港）' },
  { id: 'zh-TW', label: '中文（台灣）' }, { id: 'zh-CN', label: '中文（中国大陆）' },
  { id: 'ja', label: '日本語' }, { id: 'ko', label: '한국어' },
];
const storageKey = 'misspelled.language';
export function chooseLocale(preferred = [], saved = null) {
  if (Object.hasOwn(messages, saved)) return saved;
  for (const preference of preferred) {
    const tag = String(preference).toLowerCase();
    if (/^zh(?:-|$)/.test(tag)) {
      if (/-(hk|mo)(?:-|$)/.test(tag)) return 'zh-HK';
      if (/-tw(?:-|$)/.test(tag) || tag.includes('-hant')) return 'zh-TW';
      return 'zh-CN';
    }
    for (const id of ['en', 'ja', 'ko']) if (tag === id || tag.startsWith(`${id}-`)) return id;
  }
  return 'en';
}
export function t(locale, key, params = {}) {
  const template = messages[locale]?.[key] ?? messages.en[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (match, name) => Object.hasOwn(params, name) ? String(params[name]) : match);
}
export function loadLocale(storage, preferred) {
  let saved;
  try { saved = storage?.getItem(storageKey); } catch { /* Preferences are optional. */ }
  return chooseLocale(preferred, saved);
}
export function saveLocale(storage, locale) {
  if (!Object.hasOwn(messages, locale)) return;
  try { storage?.setItem(storageKey, locale); } catch { /* Keep the selection for this session. */ }
}
