(() => {
  'use strict';

  const VERSION = 10;
  const STORAGE_KEY = 'theater-teleprompter-settings-v3';
  const $ = selector => document.querySelector(selector);

  const elements = {
    stage: $('#stage'),
    scriptDisplay: $('#scriptDisplay'),
    navigationList: $('#navigationList'),
    sidebar: $('#sidebar'),
    sidebarBackdrop: $('#sidebarBackdrop'),
    menuButton: $('#menuButton'),
    closeMenuButton: $('#closeMenuButton'),
    navTabs: [...document.querySelectorAll('.nav-tab')],
    pageInput: $('#pageInput'),
    pageJumpButton: $('#pageJumpButton'),
    playButton: $('#playButton'),
    rewindButton: $('#rewindButton'),
    forwardButton: $('#forwardButton'),
    previousPageButton: $('#previousPageButton'),
    nextPageButton: $('#nextPageButton'),
    speedInput: $('#speedInput'),
    speedValue: $('#speedValue'),
    fontInput: $('#fontInput'),
    fontValue: $('#fontValue'),
    lineHeightInput: $('#lineHeightInput'),
    lineHeightValue: $('#lineHeightValue'),
    themeButton: $('#themeButton'),
    fullscreenButton: $('#fullscreenButton'),
    locationText: $('#locationText'),
    pageText: $('#pageText'),
    progressText: $('#progressText')
  };

  const missingElements = Object.entries(elements)
    .filter(([, value]) => value == null || (Array.isArray(value) && value.length === 0))
    .map(([key]) => key);
  if (missingElements.length) throw new Error(`Oberfläche unvollständig: ${missingElements.join(', ')}`);

  let script = null;
  let animationFrame = null;
  let lastFrameTime = 0;
  let scrollPosition = 0;
  let isPlaying = false;
  let activeNavigation = 'acts';
  let paragraphNodes = [];
  let pageTargets = new Map();
  let actTargets = [];
  let sceneTargets = [];
  let coverTarget = null;
  let activeParagraphIndex = 0;
  let currentPage = 0;

  function validateScript(candidate) {
    if (!candidate || candidate.title !== 'Die Räuber') throw new Error('Die fest eingebauten Textdaten fehlen oder gehören zum falschen Stück.');
    if (!Array.isArray(candidate.paragraphs) || candidate.paragraphs.length !== 1457) {
      throw new Error(`Theatertext unvollständig: ${candidate?.paragraphs?.length || 0}/1457 Absätze.`);
    }
    if (candidate.pageCount !== 63 || candidate.physicalPageCount !== 64) {
      throw new Error(`Seitenstruktur unvollständig: ${candidate.pageCount || 0} Textseiten.`);
    }
    if (!Array.isArray(candidate.acts) || candidate.acts.length !== 5) throw new Error('Aktstruktur unvollständig.');
    if (!Array.isArray(candidate.scenes) || candidate.scenes.length !== 15) throw new Error('Szenenstruktur unvollständig.');
    return candidate;
  }

  function loadSettings() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch {
      return {};
    }
  }

  function saveSettings() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        speed: Number(elements.speedInput.value),
        fontSize: Number(elements.fontInput.value),
        lineHeight: Number(elements.lineHeightInput.value),
        dark: document.body.classList.contains('dark')
      }));
    } catch {
      // Private browsing can deny storage. The prompter remains usable.
    }
  }

  function applySettings(settings) {
    elements.speedInput.value = String(settings.speed ?? 24);
    elements.fontInput.value = String(settings.fontSize ?? 46);
    elements.lineHeightInput.value = String(settings.lineHeight ?? 1.55);
    if (settings.dark === false) document.body.classList.remove('dark');
    updateControlLabels();
  }

  function updateControlLabels() {
    elements.speedValue.textContent = elements.speedInput.value;
    elements.fontValue.textContent = elements.fontInput.value;
    elements.lineHeightValue.textContent = Number(elements.lineHeightInput.value).toFixed(2);
    elements.scriptDisplay.style.fontSize = `${elements.fontInput.value}px`;
    elements.scriptDisplay.style.lineHeight = elements.lineHeightInput.value;
    elements.themeButton.textContent = document.body.classList.contains('dark') ? 'Heller Modus' : 'Nachtmodus';
  }

  function renderScript() {
    const fragment = document.createDocumentFragment();
    paragraphNodes = [];
    pageTargets = new Map();
    actTargets = [];
    sceneTargets = [];
    coverTarget = null;

    script.paragraphs.forEach((paragraph, index) => {
      const node = document.createElement('p');
      node.className = `script-line ${paragraph.type}`;
      node.textContent = paragraph.text;
      node.dataset.index = String(index);
      node.dataset.page = String(paragraph.page);

      if (paragraph.page === 0 && !coverTarget) {
        coverTarget = node;
        node.id = 'cover';
      }
      if (paragraph.page > 0 && !pageTargets.has(paragraph.page)) {
        node.classList.add('page-start');
        node.id = `page-${paragraph.page}`;
        node.dataset.pageLabel = `Seite ${paragraph.page}`;
        pageTargets.set(paragraph.page, node);
      }
      if (paragraph.type === 'act') actTargets.push({ ...paragraph, index, node });
      if (paragraph.type === 'scene') sceneTargets.push({ ...paragraph, index, node });

      paragraphNodes.push(node);
      fragment.append(node);
    });

    elements.scriptDisplay.replaceChildren(fragment);
    elements.pageInput.max = String(script.pageCount);
    renderNavigation();
  }

  function pageContext(page) {
    const metadata = script.pages.find(item => item.page === page);
    return [metadata?.act, metadata?.scene].filter(Boolean).join(' · ') || 'Textseite';
  }

  function navigationEntries() {
    if (activeNavigation === 'acts') {
      return actTargets.map(item => ({
        label: item.text,
        detail: `ab Seite ${item.page}`,
        page: item.page,
        index: item.index,
        node: item.node
      }));
    }
    if (activeNavigation === 'scenes') {
      return sceneTargets.map(item => ({
        label: item.text,
        detail: `${item.act} · Seite ${item.page}`,
        page: item.page,
        index: item.index,
        node: item.node
      }));
    }

    const entries = [];
    if (coverTarget) entries.push({ label: 'Titelblatt', detail: 'Vorspann', page: 0, index: 0, node: coverTarget });
    for (const [page, node] of pageTargets) {
      entries.push({ label: `Seite ${page}`, detail: pageContext(page), page, index: Number(node.dataset.index), node });
    }
    return entries;
  }

  function renderNavigation() {
    const fragment = document.createDocumentFragment();
    for (const entry of navigationEntries()) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'nav-link';
      button.dataset.page = String(entry.page);
      button.dataset.index = String(entry.index);

      const label = document.createElement('span');
      label.textContent = entry.label;
      const detail = document.createElement('small');
      detail.textContent = entry.detail;
      button.append(label, detail);
      button.addEventListener('click', () => jumpToNode(entry.node));
      fragment.append(button);
    }
    elements.navigationList.replaceChildren(fragment);
    markActiveNavigation();
  }

  function targetScrollTop(node) {
    return Math.max(0, node.offsetTop - elements.stage.clientHeight * 0.36);
  }

  function jumpToNode(node, options = {}) {
    if (!node) return false;
    stopScrolling();
    elements.stage.scrollTo({
      top: targetScrollTop(node),
      behavior: options.behavior || 'auto'
    });
    if (options.closeMenu !== false) closeMenu();
    window.setTimeout(updatePosition, (options.behavior || 'auto') === 'auto' ? 0 : 350);
    return true;
  }

  function jumpToPage(value, options = {}) {
    const page = Math.min(script.pageCount, Math.max(1, Number(value) || 1));
    return jumpToNode(pageTargets.get(page), options);
  }

  function setPlaying(nextState) {
    const next = Boolean(nextState);
    if (animationFrame) cancelAnimationFrame(animationFrame);
    animationFrame = null;
    isPlaying = next;
    elements.playButton.textContent = isPlaying ? 'Pause' : 'Start';
    elements.playButton.setAttribute('aria-pressed', String(isPlaying));
    if (isPlaying) {
      scrollPosition = elements.stage.scrollTop;
      lastFrameTime = performance.now();
      animationFrame = requestAnimationFrame(scrollStep);
    }
  }

  function stopScrolling() {
    if (isPlaying || animationFrame) setPlaying(false);
  }

  function toggleScrolling() {
    const atEnd = elements.stage.scrollTop >= elements.stage.scrollHeight - elements.stage.clientHeight - 2;
    if (atEnd) jumpToPage(1, { behavior: 'auto', closeMenu: false });
    setPlaying(!isPlaying);
  }

  function scrollStep(timestamp) {
    if (!isPlaying) return;
    const deltaSeconds = Math.min((timestamp - lastFrameTime) / 1000, 0.05);
    lastFrameTime = timestamp;
    scrollPosition += Number(elements.speedInput.value) * deltaSeconds;
    elements.stage.scrollTop = scrollPosition;
    updatePosition();

    const atEnd = elements.stage.scrollTop >= elements.stage.scrollHeight - elements.stage.clientHeight - 1;
    if (atEnd) {
      setPlaying(false);
      return;
    }
    animationFrame = requestAnimationFrame(scrollStep);
  }

  function skip(seconds) {
    stopScrolling();
    elements.stage.scrollBy({ top: Number(elements.speedInput.value) * seconds, behavior: 'smooth' });
    window.setTimeout(updatePosition, 350);
  }

  function indexAtReadingGuide() {
    const focusY = elements.stage.scrollTop + elements.stage.clientHeight * 0.37;
    let low = 0;
    let high = paragraphNodes.length - 1;
    let result = 0;
    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      if (paragraphNodes[middle].offsetTop <= focusY) {
        result = middle;
        low = middle + 1;
      } else {
        high = middle - 1;
      }
    }
    return result;
  }

  function activeTargetIndex(targets) {
    let result = targets[0]?.index ?? -1;
    for (const target of targets) {
      if (target.index <= activeParagraphIndex) result = target.index;
      else break;
    }
    return result;
  }

  function updatePosition() {
    if (!script || paragraphNodes.length === 0) return;
    const maxScroll = Math.max(elements.stage.scrollHeight - elements.stage.clientHeight, 1);
    const progress = Math.min(100, Math.max(0, (elements.stage.scrollTop / maxScroll) * 100));
    elements.progressText.textContent = `${Math.round(progress)} %`;

    activeParagraphIndex = indexAtReadingGuide();
    const active = script.paragraphs[activeParagraphIndex];
    currentPage = active.page;

    if (currentPage === 0) {
      elements.pageText.textContent = 'Titelblatt';
      elements.pageInput.value = '';
      elements.locationText.textContent = `${script.author} · ${script.title}`;
    } else {
      elements.pageText.textContent = `Seite ${currentPage}`;
      elements.pageInput.value = String(currentPage);
      elements.locationText.textContent = [active.act, active.scene].filter(Boolean).join(' · ') || script.title;
    }
    markActiveNavigation();
  }

  function markActiveNavigation() {
    const activeAct = activeTargetIndex(actTargets);
    const activeScene = activeTargetIndex(sceneTargets);
    document.querySelectorAll('.nav-link').forEach(button => {
      const index = Number(button.dataset.index);
      const page = Number(button.dataset.page);
      let active = false;
      if (activeNavigation === 'acts') active = index === activeAct;
      else if (activeNavigation === 'scenes') active = index === activeScene;
      else active = page === currentPage;
      button.classList.toggle('active', active);
      if (active) button.setAttribute('aria-current', 'true');
      else button.removeAttribute('aria-current');
    });
  }

  function setActiveNavigation(next) {
    activeNavigation = next;
    elements.navTabs.forEach(tab => {
      const selected = tab.dataset.nav === next;
      tab.classList.toggle('active', selected);
      tab.setAttribute('aria-selected', String(selected));
    });
    renderNavigation();
  }

  function openMenu() {
    document.body.classList.add('menu-open');
    elements.menuButton.setAttribute('aria-expanded', 'true');
  }

  function closeMenu() {
    document.body.classList.remove('menu-open');
    elements.menuButton.setAttribute('aria-expanded', 'false');
  }

  function updateFullscreenButton() {
    const presentation = document.body.classList.contains('presentation') || Boolean(document.fullscreenElement);
    elements.fullscreenButton.textContent = presentation ? 'Vollbild verlassen' : 'Vollbild';
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenEnabled && document.documentElement.requestFullscreen) {
        if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
        else await document.exitFullscreen();
      } else {
        document.body.classList.toggle('presentation');
      }
    } catch {
      document.body.classList.toggle('presentation');
    }
    updateFullscreenButton();
    window.setTimeout(updatePosition, 50);
  }

  function toggleTheme() {
    document.body.classList.toggle('dark');
    updateControlLabels();
    saveSettings();
  }

  function showFatalError(error) {
    console.error(error);
    const heading = document.createElement('p');
    heading.className = 'loading-text error-title';
    heading.textContent = 'Fehler beim Laden';
    const detail = document.createElement('p');
    detail.className = 'loading-text error-detail';
    detail.textContent = error?.message || String(error);
    elements.scriptDisplay.replaceChildren(heading, detail);
    elements.pageText.textContent = 'Fehler';
    elements.locationText.textContent = 'Die Räuber';
  }

  function bindEvents() {
    elements.playButton.addEventListener('click', toggleScrolling);
    elements.rewindButton.addEventListener('click', () => skip(-10));
    elements.forwardButton.addEventListener('click', () => skip(10));
    elements.previousPageButton.addEventListener('click', () => jumpToPage(Math.max(1, currentPage - 1)));
    elements.nextPageButton.addEventListener('click', () => jumpToPage(Math.min(script.pageCount, Math.max(1, currentPage + 1))));
    elements.pageJumpButton.addEventListener('click', () => jumpToPage(elements.pageInput.value));
    elements.pageInput.addEventListener('keydown', event => {
      if (event.key === 'Enter') jumpToPage(elements.pageInput.value);
    });
    elements.navTabs.forEach(tab => tab.addEventListener('click', () => setActiveNavigation(tab.dataset.nav)));
    elements.menuButton.addEventListener('click', openMenu);
    elements.closeMenuButton.addEventListener('click', closeMenu);
    elements.sidebarBackdrop.addEventListener('click', closeMenu);
    elements.themeButton.addEventListener('click', toggleTheme);
    elements.fullscreenButton.addEventListener('click', toggleFullscreen);

    elements.speedInput.addEventListener('input', () => { updateControlLabels(); saveSettings(); });
    elements.fontInput.addEventListener('input', () => { updateControlLabels(); saveSettings(); updatePosition(); });
    elements.lineHeightInput.addEventListener('input', () => { updateControlLabels(); saveSettings(); updatePosition(); });
    elements.stage.addEventListener('scroll', updatePosition, { passive: true });
    window.addEventListener('resize', updatePosition, { passive: true });
    document.addEventListener('fullscreenchange', () => {
      if (!document.fullscreenElement) document.body.classList.remove('presentation');
      updateFullscreenButton();
    });

    document.addEventListener('keydown', event => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (event.code === 'Space') {
        event.preventDefault();
        toggleScrolling();
      } else if (event.code === 'ArrowUp') {
        event.preventDefault();
        elements.speedInput.value = String(Math.min(100, Number(elements.speedInput.value) + 2));
        elements.speedInput.dispatchEvent(new Event('input'));
      } else if (event.code === 'ArrowDown') {
        event.preventDefault();
        elements.speedInput.value = String(Math.max(4, Number(elements.speedInput.value) - 2));
        elements.speedInput.dispatchEvent(new Event('input'));
      } else if (event.code === 'ArrowLeft') {
        event.preventDefault();
        jumpToPage(Math.max(1, currentPage - 1));
      } else if (event.code === 'ArrowRight') {
        event.preventDefault();
        jumpToPage(Math.min(script.pageCount, Math.max(1, currentPage + 1)));
      } else if (event.key.toLowerCase() === 'f') {
        event.preventDefault();
        toggleFullscreen();
      } else if (event.key.toLowerCase() === 'm') {
        event.preventDefault();
        document.body.classList.contains('menu-open') ? closeMenu() : openMenu();
      } else if (event.key === 'Escape') {
        closeMenu();
        if (document.body.classList.contains('presentation') && !document.fullscreenElement) {
          document.body.classList.remove('presentation');
          updateFullscreenButton();
        }
      }
    });
  }

  async function initialize() {
    script = validateScript(await window.loadTheaterScript());
    applySettings(loadSettings());
    bindEvents();
    renderScript();
    requestAnimationFrame(() => jumpToPage(1, { behavior: 'auto', closeMenu: false }));

    window.__TELEPROMPTER__ = {
      version: VERSION,
      getState: () => ({
        version: VERSION,
        title: script.title,
        paragraphs: script.paragraphs.length,
        pages: script.pageCount,
        acts: script.acts.length,
        scenes: script.scenes.length,
        currentPage,
        activeParagraphIndex,
        isPlaying,
        activeNavigation,
        dark: document.body.classList.contains('dark'),
        presentation: document.body.classList.contains('presentation') || Boolean(document.fullscreenElement)
      }),
      jumpToPage: page => jumpToPage(page, { behavior: 'auto', closeMenu: false }),
      updatePosition
    };
  }

  initialize().catch(showFatalError);

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        const registration = await navigator.serviceWorker.register(`./service-worker.js?v=${VERSION}`);
        registration.update().catch(() => {});
      } catch (error) {
        console.warn('Offline-Modus konnte nicht registriert werden:', error);
      }
    });
  }
})();
