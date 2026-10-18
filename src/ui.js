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
        <button id="return-word-sprout" type="button" class="button secondary" data-text="returnToWordSprout" hidden></button>
        <button id="open-settings" type="button" class="button secondary" aria-haspopup="dialog" aria-controls="settings-panel" aria-expanded="false" data-text="settings"></button>
      </div>
    </header>
    <dialog id="settings-panel" class="settings-panel" aria-labelledby="settings-title">
      <div class="settings-heading"><h2 id="settings-title" data-text="settings"></h2><button id="close-settings" type="button" class="button secondary" data-text="closeSettings"></button></div>
      <div class="settings-field"><label for="language" data-text="language"></label><select id="language" autofocus></select></div>
      <div class="settings-field"><label for="extra-letter-style" data-text="extraLetterStyle"></label><select id="extra-letter-style"><option value="highlight" data-text="styleHighlight"></option><option value="strike" data-text="styleStrike"></option></select></div>
    </dialog>
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
  const settingsPanel = query('#settings-panel');
  const settingsButton = query('#open-settings');
  const events = new AbortController();
  const listen = (element, event, handler) => element.addEventListener(event, handler, { signal: events.signal });
  let clearAnimations = [];
  let clearSnapshots = [];
  let clearTransition = 0;
  function stopClearTransition() {
    clearTransition++;
    for (const animation of clearAnimations) animation.cancel();
    for (const snapshot of clearSnapshots) snapshot.remove();
    clearAnimations = [];
    clearSnapshots = [];
  }
  function clearWord() {
    stopClearTransition();
    const animate = typeof input.animate === 'function' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const snapshots = [];
    const scrollPositions = new Map();
    if (animate && client.getState().input) {
      for (const element of [input, results]) {
        const bounds = element.getBoundingClientRect();
        const snapshot = element.cloneNode(true);
        snapshot.removeAttribute('id');
        for (const child of snapshot.querySelectorAll('[id]')) child.removeAttribute('id');
        snapshot.classList.add('clear-snapshot');
        snapshot.setAttribute('aria-hidden', 'true');
        snapshot.inert = true;
        if (element === input) {
          snapshot.classList.add('clear-input-snapshot');
          snapshot.value = input.value;
        }
        Object.assign(snapshot.style, { left: `${bounds.left}px`, top: `${bounds.top}px`, width: `${bounds.width}px`, height: `${bounds.height}px` });
        scrollPositions.set(snapshot, { left: element.scrollLeft, top: element.scrollTop });
        snapshots.push(snapshot);
      }
    }
    client.clear();
    input.focus();
    if (!snapshots.length) return;
    clearSnapshots = snapshots;
    document.body.append(...snapshots);
    for (const [snapshot, position] of scrollPositions) {
      snapshot.scrollLeft = position.left;
      snapshot.scrollTop = position.top;
    }
    const timing = { duration: 240, easing: 'ease-out' };
    clearAnimations = [
      ...snapshots.map(snapshot => snapshot.animate([{ opacity: 1 }, { opacity: 0 }], timing)),
      results.animate([{ opacity: 0 }, { opacity: 1 }], timing),
    ];
    const transition = clearTransition;
    const finish = () => { if (transition === clearTransition) stopClearTransition(); };
    Promise.all(clearAnimations.map(animation => animation.finished)).then(finish, finish);
  }
  listen(settingsButton, 'click', () => {
    stopClearTransition();
    if (!settingsPanel.open) settingsPanel.showModal();
    settingsButton.setAttribute('aria-expanded', 'true');
  });
  listen(query('#close-settings'), 'click', () => settingsPanel.close());
  listen(settingsPanel, 'close', () => {
    settingsButton.setAttribute('aria-expanded', 'false');
    settingsButton.focus();
  });
  listen(settingsPanel, 'keydown', event => {
    if (event.key !== 'Tab') return;
    const controls = settingsPanel.querySelectorAll('button:not(:disabled), select:not(:disabled)');
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  listen(settingsPanel, 'click', event => {
    if (event.target !== settingsPanel) return;
    const bounds = settingsPanel.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) settingsPanel.close();
  });
  let copyFeedback = '';
  let copyAttempt = 0;
  let previousInput = '';
  let selectedWord = null;
  let correctedWord = null;
  const actionWord = () => correctedWord ?? client.getState().input.trim();
  const run = mode => client.run(mode, actionWord());
  function setCorrection(word) {
    correctedWord = word;
    copyAttempt++;
    copyFeedback = '';
    query('#copy-feedback').textContent = '';
  }
  let extraLetterStyle = loadExtraLetterStyle(storage);
  let refreshComparison = () => {};
  let comparisonObserver;
  listen(window, 'resize', () => { stopClearTransition(); refreshComparison(); });
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
    if (event.key === 'Enter' && !event.isComposing) { event.preventDefault(); run('check'); }
  });
  listen(query('#word-form'), 'submit', event => { event.preventDefault(); run('check'); });
  listen(query('#similar'), 'click', () => run('similar'));
  listen(query('#clear'), 'click', clearWord);
  listen(language, 'change', () => { setLocale(language.value); render(); });
  listen(query('#copy'), 'click', async () => {
    const word = actionWord();
    const attempt = ++copyAttempt;
    let fallback = false;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Unavailable');
      await navigator.clipboard.writeText(word);
      if (attempt === copyAttempt) copyFeedback = 'copied';
    } catch {
      if (attempt === copyAttempt) { fallback = true; copyFeedback = 'copyFallback'; }
    }
    if (attempt !== copyAttempt) return;
    render();
    if (fallback) {
      const correction = query('.correction-box .comparison-word');
      if (correction && correction.textContent === word) {
        const range = document.createRange();
        range.selectNodeContents(correction);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
      } else { input.focus(); input.select(); }
    }
  });

  function render() {
    stopClearTransition();
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
    if (state.input !== previousInput) { setCorrection(null); previousInput = state.input; }
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
      const originalText = state.input.trim();
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
        originalWord.textContent = originalText;
        original.append(originalLabel, originalWord);
      }
      if (result.suggestions.length || (originalWord && result.word !== originalText)) {
        const comparison = add('div', '', 'comparison-box correction-box');
        comparison.setAttribute('aria-live', 'off');
        comparison.tabIndex = -1;
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
          selectedWord = null;
          setCorrection(null);
          hovered = null;
          focused = null;
          reserveComparisonSpace();
          comparison.focus();
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
          const selected = Boolean(candidate && candidate === selectedWord) || (!result.suggestions.length && result.correct);
          const displayedWord = candidate ?? correctedWord ?? originalText;
          originalWord.classList.toggle('strike-extra', extraLetterStyle === 'strike');
          originalWord.replaceChildren();
          for (const part of compareWord(originalText, displayedWord, { separateDeletions: true })) {
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
          // Align from the candidate so every displayed character belongs to the correction.
          for (const part of compareWord(displayedWord, originalText)) {
            if (part.type === 'gap') continue;
            const segment = document.createElement(part.type === 'same' ? 'span' : 'mark');
            segment.textContent = part.text;
            if (part.type === 'changed' && !part.expected) {
              segment.className = 'comparison-inserted';
              segment.setAttribute('aria-label', translate('missingLetters', { letters: part.text }));
            }
            preview.append(segment);
          }
          hint.hidden = selected || !result.suggestions.length;
          hint.textContent = selected ? '' : candidate ? translate('comparingWith', { word: candidate }) : translate('comparisonHint');
          reset.hidden = !selectedWord && !correctedWord;
          reselect.hidden = !selectedWord;
          comparisonActions.hidden = reset.hidden && reselect.hidden;
          choiceHint.hidden = Boolean(selectedWord) || !result.suggestions.length;
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
          for (const word of selectedWord ? [selectedWord] : [null, ...result.suggestions]) {
            showComparison(word);
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
          button.addEventListener('click', () => { if (selectedWord) return; selectedWord = word; setCorrection(word); hovered = null; focused = null; reserveComparisonSpace(); reselect.focus(); });
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
  return { render, dispose() { stopClearTransition(); comparisonObserver?.disconnect(); if (settingsPanel.open) settingsPanel.close(); events.abort(); client.dispose(); } };
}
