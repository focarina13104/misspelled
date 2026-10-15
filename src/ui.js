import { t, supportedLocales } from './i18n.js';
import { compareWord } from './comparison.js';
import { loadExtraLetterStyle, saveExtraLetterStyle } from './preferences.js';

const checkIcon = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m5 12 4 4L19 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const searchIcon = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" stroke-width="1.7"/><path d="m16 16 4 4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';
const copyIcon = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="3" stroke="currentColor" stroke-width="1.6"/><path d="M15 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2" stroke="currentColor" stroke-width="1.6"/></svg>';

export function mountUI(root, { client, getLocale, setLocale, storage }) {
  root.innerHTML = `
    <header class="topbar">
      <div class="brand"><div class="brand-mark" aria-hidden="true">m<span>✓</span></div><div><div class="brand-name">Misspelled<span class="brand-dot">.</span></div><p data-text="tagline"></p></div></div>
      <div class="header-actions">
        <button id="return-word-sprout" type="button" class="button secondary" data-text="returnToWordSprout"></button>
        <div class="language-control"><label for="language" data-text="language"></label><select id="language"></select></div>
      </div>
    </header>
    <main class="main-content">
      <section class="hero" aria-labelledby="hero-title"><p class="eyebrow hero-eyebrow"><span class="tiny-dot" aria-hidden="true"></span><span data-text="eyebrow"></span></p><h1 id="hero-title" data-text="heroTitle"></h1><p class="hero-description" data-text="heroDescription"></p></section>
      <div class="workspace">
        <section class="panel editor-panel" aria-labelledby="editor-title">
          <div class="panel-heading"><span class="step-number" aria-hidden="true">01</span><p class="eyebrow" data-text="editorEyebrow"></p></div>
          <h2 id="editor-title" data-text="editorTitle"></h2>
          <form id="word-form" novalidate>
            <div class="field-top"><label for="word" data-text="wordLabel"></label><button type="button" class="text-button" id="clear" data-text="clear"></button></div>
            <textarea id="word" rows="1" wrap="off" lang="en" autocomplete="off" autocapitalize="off" spellcheck="false" aria-describedby="word-hint word-feedback"></textarea>
            <div class="field-meta"><p id="word-hint" data-text="inputHint"></p><span id="character-count"></span></div>
            <p class="word-feedback" id="word-feedback"></p>
            <div class="actions"><button class="button primary" id="check" type="submit">${checkIcon}<span data-text="checkSpelling"></span></button><button class="button secondary" id="similar" type="button">${searchIcon}<span data-text="findSimilarWords"></span></button></div>
          </form>
          <div class="editor-bottom"><span class="dialect"><span class="tiny-dot" aria-hidden="true"></span><span data-text="usUk"></span></span><button id="copy" class="copy-button" type="button">${copyIcon}<span data-text="copy"></span></button></div>
          <p id="copy-feedback" class="copy-feedback" aria-live="polite"></p>
        </section>
        <section class="panel result-panel" aria-labelledby="result-title">
          <div class="panel-heading"><span class="step-number" aria-hidden="true">02</span><p class="eyebrow" data-text="resultEyebrow"></p><span id="result-count" class="count-badge"></span></div>
          <h2 id="result-title" data-text="resultTitle"></h2>
          <div class="comparison-preferences"><label for="extra-letter-style" data-text="extraLetterStyle"></label><select id="extra-letter-style"><option value="highlight" data-text="styleHighlight"></option><option value="strike" data-text="styleStrike"></option></select></div>
          <div id="results" class="results" aria-live="polite" aria-atomic="true"></div>
        </section>
      </div>
      <aside class="privacy-note"><div class="shield-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M12 3 4 6v5c0 5 8 10 8 10s8-5 8-10V6l-8-3Z" stroke="currentColor" stroke-width="1.5"/><path d="m9 11 2 2 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></div><div><h3 data-text="privacyTitle"></h3><p data-text="privacyDescription"></p></div></aside>
    </main>
    <footer class="footer"><span>Misspelled<span class="brand-dot">.</span></span><p data-text="footerNote"></p><div class="license-links"><a href="${import.meta.env.BASE_URL}licenses/nspell.txt">nspell</a><a href="${import.meta.env.BASE_URL}licenses/dictionary-en.txt" data-text="licenses"></a><a href="${import.meta.env.BASE_URL}licenses/dictionary-en-gb.txt">UK</a></div></footer>`;
  const query = selector => root.querySelector(selector);
  const input = query('#word');
  const language = query('#language');
  const results = query('#results');
  const feedback = query('#word-feedback');
  const events = new AbortController();
  const listen = (element, event, handler) => element.addEventListener(event, handler, { signal: events.signal });
  let copyFeedback = '';
  let copyAttempt = 0;
  let previousInput = '';
  let selectedWord = null;
  let extraLetterStyle = loadExtraLetterStyle(storage);
  let refreshComparison = () => {};
  let comparisonObserver;
  listen(window, 'resize', () => refreshComparison());
  document.fonts?.ready.then(() => { if (!events.signal.aborted) refreshComparison(); });
  const styleSelect = query('#extra-letter-style');
  styleSelect.value = extraLetterStyle;
  listen(styleSelect, 'change', () => {
    extraLetterStyle = styleSelect.value;
    saveExtraLetterStyle(storage, extraLetterStyle);
    refreshComparison();
  });
  for (const { id, label } of supportedLocales) {
    const option = document.createElement('option');
    option.value = id;
    option.lang = id;
    option.textContent = label;
    language.append(option);
  }
  listen(input, 'input', () => {
    const { selectionStart, selectionEnd, selectionDirection } = input;
    client.setInput(input.value);
    input.setSelectionRange(selectionStart, selectionEnd, selectionDirection);
  });
  listen(input, 'keydown', event => {
    if (event.key === 'Enter' && !event.isComposing) { event.preventDefault(); client.run('check'); }
  });
  listen(query('#word-form'), 'submit', event => { event.preventDefault(); client.run('check'); });
  listen(query('#similar'), 'click', () => client.run('similar'));
  listen(query('#clear'), 'click', () => { client.clear(); input.focus(); });
  listen(language, 'change', () => { setLocale(language.value); render(); });
  listen(query('#copy'), 'click', async () => {
    const word = client.getState().input.trim();
    const attempt = ++copyAttempt;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Unavailable');
      await navigator.clipboard.writeText(word);
      if (attempt === copyAttempt) copyFeedback = 'copied';
    } catch {
      if (attempt === copyAttempt) { input.focus(); input.select(); copyFeedback = 'copyFallback'; }
    }
    render();
  });

  function render() {
    const state = client.getState();
    const locale = getLocale();
    const translate = (key, params) => t(locale, key, params);
    comparisonObserver?.disconnect();
    refreshComparison = () => {};
    if (!state.result?.ok || !state.result.suggestions.includes(selectedWord)) selectedWord = null;
    document.documentElement.lang = locale;
    document.title = 'Misspelled';
    language.value = locale;
    for (const element of root.querySelectorAll('[data-text]')) element.textContent = translate(element.dataset.text);
    if (state.input !== previousInput) { copyAttempt++; copyFeedback = ''; previousInput = state.input; }
    if (input.value !== state.input) input.value = state.input;
    const length = state.input.trim().length;
    const count = query('#character-count');
    count.textContent = `${length}/100`;
    count.setAttribute('aria-label', translate('characterCount', { count: length }));
    count.classList.toggle('over-limit', length > 100);
    const unavailable = ['loading', 'busy', 'error'].includes(state.status);
    query('#check').disabled = unavailable;
    query('#similar').disabled = unavailable;
    query('#copy').disabled = !state.input.trim();
    query('#clear').disabled = !state.input;
    query('#copy-feedback').textContent = copyFeedback ? translate(copyFeedback) : '';
    const invalid = state.result?.ok === false;
    feedback.textContent = invalid ? translate(state.result.errorCode) : '';
    input.setAttribute('aria-invalid', String(invalid));
    const total = state.result?.suggestions?.length ?? 0;
    query('#result-count').textContent = total ? translate(total === 1 ? 'suggestionCountOne' : 'suggestionCountMany', { count: total }) : '';
    results.setAttribute('aria-busy', String(['loading', 'busy'].includes(state.status)));
    results.replaceChildren();
    function add(tag, text, className = '') {
      const element = document.createElement(tag);
      element.textContent = text;
      element.className = className;
      results.append(element);
      return element;
    }
    if (state.status === 'loading' || state.status === 'busy') {
      add('span', '', 'spinner');
      add('h3', translate(state.status === 'loading' ? 'loadingTitle' : state.mode === 'check' ? 'busyCheck' : 'busySimilar'));
      if (state.status === 'loading') add('p', translate('loadingDescription'), 'muted');
    } else if (state.status === 'error') {
      add('div', '!', 'state-symbol error-symbol');
      add('h3', translate(state.errorCode));
      const retry = add('button', translate('retry'), 'button secondary retry-button');
      retry.type = 'button';
      retry.addEventListener('click', () => client.retry(), { once: true });
    } else if (!state.result || invalid) {
      const symbol = add('div', 'Aa', 'state-symbol empty-symbol');
      symbol.setAttribute('aria-hidden', 'true');
      add('h3', translate(invalid ? state.result.errorCode : 'emptyTitle'));
      add('p', translate('emptyDescription'), 'muted');
    } else {
      const result = state.result;
      const status = add('p', '', result.correct ? 'spelling-status correct-status' : 'spelling-status warning-status');
      status.textContent = `${result.correct ? '✓' : '!'} ${translate(result.correct ? 'correctTitle' : 'incorrectDescription', { word: result.word })}`;
      if (state.mode === 'similar') {
        add('h3', translate('similarTitle'));
        add('p', translate('similarDescription'), 'muted');
      } else if (!result.correct) add('h3', translate('incorrectTitle'));
      let originalWord;
      if (result.correct || result.suggestions.length) {
        const original = add('div', '', 'comparison-box original-box');
        original.setAttribute('aria-live', 'off');
        const originalLabel = document.createElement('p');
        originalLabel.className = 'comparison-label';
        originalLabel.textContent = translate('comparisonLabel');
        originalWord = document.createElement('div');
        originalWord.className = 'comparison-word original-word';
        originalWord.lang = 'en';
        originalWord.textContent = result.word;
        original.append(originalLabel, originalWord);
      }
      if (result.suggestions.length) {
        const comparison = add('div', '', 'comparison-box correction-box');
        comparison.setAttribute('aria-live', 'off');
        const label = document.createElement('p');
        label.className = 'comparison-label';
        label.textContent = translate('correctedLabel');
        const preview = document.createElement('div');
        preview.className = 'comparison-word';
        preview.lang = 'en';
        const hint = document.createElement('p');
        hint.id = 'comparison-help';
        hint.className = 'comparison-hint';
        const comparisonActions = document.createElement('div');
        comparisonActions.className = 'comparison-actions';
        const reselect = document.createElement('button');
        reselect.type = 'button';
        reselect.className = 'button secondary comparison-reselect';
        reselect.textContent = translate('reselect');
        reselect.addEventListener('click', () => {
          const previousSelection = selectedWord;
          selectedWord = null;
          hovered = null;
          focused = null;
          showComparison();
          suggestionButtons.find(button => button.textContent === previousSelection)?.focus();
        });
        const reset = document.createElement('button');
        reset.type = 'button';
        reset.className = 'button secondary comparison-reset';
        reset.textContent = translate('reset');
        reset.addEventListener('click', () => { client.clear(); input.focus(); });
        comparisonActions.append(reselect, reset);
        comparison.append(label, preview, hint, comparisonActions);
        let hovered = null;
        let focused = null;
        const suggestionButtons = [];
        const choiceHint = document.createElement('p');
        choiceHint.className = 'choice-hint';
        function showComparison(candidate = selectedWord ?? hovered ?? focused) {
          const selected = Boolean(candidate && candidate === selectedWord);
          originalWord.classList.toggle('strike-extra', extraLetterStyle === 'strike');
          originalWord.replaceChildren();
          if (!candidate) originalWord.textContent = result.word;
          else for (const part of compareWord(result.word, candidate, { separateDeletions: true })) {
            if (!part.text) continue;
            const extra = part.type === 'changed' && !part.expected;
            const segment = document.createElement(extra ? 'mark' : 'span');
            segment.textContent = part.text;
            if (extra) {
              segment.className = 'comparison-extra';
              segment.setAttribute('aria-label', translate('extraLetters', { letters: part.text }));
            }
            originalWord.append(segment);
          }
          preview.classList.toggle('is-corrected', selected);
          preview.replaceChildren();
          if (!candidate) preview.textContent = result.word;
          // Align from the candidate so every displayed character belongs to the correction.
          else for (const part of compareWord(candidate, result.word)) {
            if (part.type === 'gap') continue;
            const segment = document.createElement(part.type === 'same' ? 'span' : 'mark');
            segment.textContent = part.text;
            if (part.type === 'changed' && !part.expected) {
              segment.className = 'comparison-inserted';
              segment.setAttribute('aria-label', translate('missingLetters', { letters: part.text }));
            }
            preview.append(segment);
          }
          hint.hidden = selected;
          hint.textContent = selected ? '' : candidate ? translate('comparingWith', { word: candidate }) : translate('comparisonHint');
          reset.hidden = !selectedWord;
          reselect.hidden = !selectedWord;
          comparisonActions.hidden = !selectedWord;
          choiceHint.hidden = Boolean(selectedWord);
          choiceHint.textContent = selectedWord ? '' : translate('choiceHint');
          for (const button of suggestionButtons) {
            button.setAttribute('aria-pressed', String(button.textContent === selectedWord));
            button.disabled = Boolean(selectedWord);
          }
        }
        function reserveComparisonSpace() {
          const currentCandidate = selectedWord ?? hovered ?? focused;
          const originalBox = originalWord.parentElement;
          originalBox.style.minHeight = '';
          comparison.style.minHeight = '';
          let originalHeight = 0;
          let correctionHeight = 0;
          for (const word of [null, ...result.suggestions]) {
            showComparison(word);
            comparisonActions.hidden = false;
            reselect.hidden = false;
            reset.hidden = false;
            originalHeight = Math.max(originalHeight, originalBox.getBoundingClientRect().height);
            correctionHeight = Math.max(correctionHeight, comparison.getBoundingClientRect().height);
          }
          originalBox.style.minHeight = `${Math.ceil(originalHeight)}px`;
          comparison.style.minHeight = `${Math.ceil(correctionHeight)}px`;
          showComparison(currentCandidate);
        }
        const choices = add('div', '', 'suggestion-list');
        for (const word of result.suggestions) {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'suggestion';
          button.lang = 'en';
          button.textContent = word;
          button.setAttribute('aria-label', translate('useWord', { word }));
          button.setAttribute('aria-describedby', 'comparison-help');
          button.addEventListener('mouseenter', () => { if (selectedWord) return; hovered = word; showComparison(); });
          button.addEventListener('mouseleave', () => { hovered = null; showComparison(); });
          button.addEventListener('focus', () => { if (selectedWord) return; hovered = null; focused = word; showComparison(); });
          button.addEventListener('blur', () => { focused = null; showComparison(); });
          button.addEventListener('click', () => { if (selectedWord) return; selectedWord = word; hovered = null; focused = null; showComparison(); reselect.focus(); });
          suggestionButtons.push(button);
          choices.append(button);
        }
        reserveComparisonSpace();
        refreshComparison = reserveComparisonSpace;
        results.append(choiceHint);
        if (typeof ResizeObserver !== 'undefined') {
          let reservedWidth = comparison.getBoundingClientRect().width;
          comparisonObserver = new ResizeObserver(() => {
            const width = comparison.getBoundingClientRect().width;
            if (!comparison.isConnected || Math.abs(width - reservedWidth) < 0.5) return;
            reservedWidth = width;
            reserveComparisonSpace();
          });
          comparisonObserver.observe(comparison);
        }
      } else if (state.mode === 'check' && result.correct) {
        const symbol = add('div', '✓', 'state-symbol success-symbol');
        symbol.setAttribute('aria-hidden', 'true');
        add('p', translate('correctHint'), 'muted');
      } else {
        add('h3', translate('noSuggestions'));
        add('p', translate('noSuggestionsHint'), 'muted');
      }
    }
    results.classList.toggle('has-results', Boolean(state.result?.ok));
  }
  return { render, dispose() { comparisonObserver?.disconnect(); events.abort(); client.dispose(); } };
}
