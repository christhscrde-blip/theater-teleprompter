let script;
const elements = {
  stage: document.querySelector('#stage'),
  scriptDisplay: document.querySelector('#scriptDisplay'),
  navigationList: document.querySelector('#navigationList'),
  sidebar: document.querySelector('#sidebar'),
  sidebarBackdrop: document.querySelector('#sidebarBackdrop'),
  menuButton: document.querySelector('#menuButton'),
  closeMenuButton: document.querySelector('#closeMenuButton'),
  navTabs: [...document.querySelectorAll('.nav-tab')],
  pageInput: document.querySelector('#pageInput'),
  pageJumpButton: document.querySelector('#pageJumpButton'),
  playButton: document.querySelector('#playButton'),
  rewindButton: document.querySelector('#rewindButton'),
  forwardButton: document.querySelector('#forwardButton'),
  previousPageButton: document.querySelector('#previousPageButton'),
  nextPageButton: document.querySelector('#nextPageButton'),
  speedInput: document.querySelector('#speedInput'),
  speedValue: document.querySelector('#speedValue'),
  fontInput: document.querySelector('#fontInput'),
  fontValue: document.querySelector('#fontValue'),
  lineHeightInput: document.querySelector('#lineHeightInput'),
  lineHeightValue: document.querySelector('#lineHeightValue'),
  themeButton: document.querySelector('#themeButton'),
  fullscreenButton: document.querySelector('#fullscreenButton'),
  locationText: document.querySelector('#locationText'),
  pageText: document.querySelector('#pageText'),
  progressText: document.querySelector('#progressText')
};

const STORAGE_KEY = 'theater-teleprompter-settings-v2';
let animationFrame = null;
let lastFrameTime = 0;
let isPlaying = false;
let activeNavigation = 'acts';
let paragraphNodes = [];
let pageTargets = new Map();
let actTargets = [];
let sceneTargets = [];
let currentPage = 1;

function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? {};
  } catch {
    return {};
  }
}

function saveSettings() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    speed: Number(elements.speedInput.value),
    fontSize: Number(elements.fontInput.value),
    lineHeight: Number(elements.lineHeightInput.value),
    dark: document.body.classList.contains('dark')
  }));
}

function renderScript() {
  const fragment = document.createDocumentFragment();
  paragraphNodes = [];
  pageTargets = new Map();
  actTargets = [];
  sceneTargets = [];

  script.paragraphs.forEach((paragraph, index) => {
    const node = document.createElement('p');
    node.className = `script-line ${paragraph.type}`;
    node.textContent = paragraph.text;
    node.dataset.index = String(index);
    node.dataset.page = String(paragraph.page);

    if (!pageTargets.has(paragraph.page)) {
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
  updatePosition();
}

function renderNavigation() {
  elements.navigationList.replaceChildren();
  let entries;

  if (activeNavigation === 'acts') {
    entries = actTargets.map(entry => ({
      label: entry.text,
      detail: `ab Seite ${entry.page}`,
      page: entry.page,
      node: entry.node
    }));
  } else if (activeNavigation === 'scenes') {
    entries = sceneTargets.map(entry => ({
      label: entry.text,
      detail: `${entry.act} · Seite ${entry.page}`,
      page: entry.page,
      node: entry.node
    }));
  } else {
    entries = [...pageTargets.entries()].map(([page, node]) => ({
      label: `Seite ${page}`,
      detail: page === 1 ? 'Titelblatt' : findPageContext(page),
      page,
      node
    }));
  }

  const fragment = document.createDocumentFragment();
  entries.forEach(entry => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'nav-link';
    button.dataset.page = String(entry.page);
    button.innerHTML = `<span>${escapeHtml(entry.label)}</span><small>${escapeHtml(entry.detail)}</small>`;
    button.addEventListener('click', () => jumpToNode(entry.node));
    fragment.append(button);
  });
  elements.navigationList.append(fragment);
  markActiveNavigation();
}

function escapeHtml(value) {
  return value.replace(/[&<>"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char]);
}

function findPageContext(page) {
  const paragraph = script.paragraphs.find(item => item.page === page);
  if (!paragraph) return '';
  const pieces = [paragraph.act, paragraph.scene].filter(Boolean);
  return pieces.join(' · ') || 'Textseite';
}

function jumpToNode(node) {
  if (!node) return;
  stopScrolling();
  elements.stage.scrollTo({
    top: Math.max(0, node.offsetTop - elements.stage.clientHeight * 0.32),
    behavior: 'smooth'
  });
  closeMenu();
  window.setTimeout(updatePosition, 320);
}

function jumpToPage(page) {
  const bounded = Math.min(script.pageCount, Math.max(1, Number(page) || 1));
  jumpToNode(pageTargets.get(bounded));
}

function setPlaying(nextState) {
  isPlaying = nextState;
  elements.playButton.textContent = isPlaying ? 'Pause' : 'Start';
  if (isPlaying) {
    lastFrameTime = performance.now();
    animationFrame = requestAnimationFrame(scrollStep);
  } else if (animationFrame) {
    cancelAnimationFrame(animationFrame);
    animationFrame = null;
  }
}

function toggleScrolling() {
  const atEnd = elements.stage.scrollTop >= elements.stage.scrollHeight - elements.stage.clientHeight - 2;
  if (atEnd) elements.stage.scrollTop = 0;
  setPlaying(!isPlaying);
}

function stopScrolling() {
  if (isPlaying) setPlaying(false);
}

function scrollStep(timestamp) {
  if (!isPlaying) return;
  const deltaSeconds = Math.min((timestamp - lastFrameTime) / 1000, 0.05);
  lastFrameTime = timestamp;
  elements.stage.scrollTop += Number(elements.speedInput.value) * deltaSeconds;
  updatePosition();

  const atEnd = elements.stage.scrollTop >= elements.stage.scrollHeight - elements.stage.clientHeight - 1;
  if (atEnd) {
    setPlaying(false);
    return;
  }
  animationFrame = requestAnimationFrame(scrollStep);
}

function skip(seconds) {
  const distance = Number(elements.speedInput.value) * seconds;
  elements.stage.scrollBy({ top: distance, behavior: 'smooth' });
  window.setTimeout(updatePosition, 300);
}

function updatePosition() {
  const maxScroll = Math.max(elements.stage.scrollHeight - elements.stage.clientHeight, 1);
  const progress = Math.min(100, Math.max(0, elements.stage.scrollTop / maxScroll * 100));
  elements.progressText.textContent = `${Math.round(progress)} %`;

  const focusY = elements.stage.scrollTop + elements.stage.clientHeight * 0.38;
  let active = script.paragraphs[0];
  for (let index = 0; index < paragraphNodes.length; index += 1) {
    if (paragraphNodes[index].offsetTop <= focusY) active = script.paragraphs[index];
    else break;
  }

  currentPage = active?.page || 1;
  elements.pageText.textContent = `Seite ${currentPage}`;
  elements.pageInput.value = String(currentPage);
  const location = [active?.act, active?.scene].filter(Boolean).join(' · ');
  elements.locationText.textContent = location || script.title;
  markActiveNavigation();
}

function markActiveNavigation() {
  document.querySelectorAll('.nav-link').forEach(button => {
    button.classList.toggle('active', Number(button.dataset.page) === currentPage);
  });
}

function setActiveNavigation(next) {
  activeNavigation = next;
  elements.navTabs.forEach(tab => tab.classList.toggle('active', tab.dataset.nav === next));
  renderNavigation();
}

function openMenu() {
  document.body.classList.add('menu-open');
}

function closeMenu() {
  document.body.classList.remove('menu-open');
}

async function toggleFullscreen() {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
      document.body.classList.add('presentation');
    } else {
      await document.exitFullscreen();
    }
  } catch {
    document.body.classList.toggle('presentation');
  }
}

function toggleTheme() {
  document.body.classList.toggle('dark');
  elements.themeButton.textContent = document.body.classList.contains('dark') ? 'Heller Modus' : 'Nachtmodus';
  saveSettings();
}

function applySettings(settings) {
  elements.speedInput.value = settings.speed || 24;
  elements.fontInput.value = settings.fontSize || 46;
  elements.lineHeightInput.value = settings.lineHeight || 1.55;
  elements.speedValue.textContent = elements.speedInput.value;
  elements.fontValue.textContent = elements.fontInput.value;
  elements.lineHeightValue.textContent = Number(elements.lineHeightInput.value).toFixed(2);
  elements.scriptDisplay.style.fontSize = `${elements.fontInput.value}px`;
  elements.scriptDisplay.style.lineHeight = elements.lineHeightInput.value;
  if (settings.dark === false) {
    document.body.classList.remove('dark');
    elements.themeButton.textContent = 'Nachtmodus';
  }
}

elements.playButton.addEventListener('click', toggleScrolling);
elements.rewindButton.addEventListener('click', () => skip(-10));
elements.forwardButton.addEventListener('click', () => skip(10));
elements.previousPageButton.addEventListener('click', () => jumpToPage(currentPage - 1));
elements.nextPageButton.addEventListener('click', () => jumpToPage(currentPage + 1));
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

elements.speedInput.addEventListener('input', () => {
  elements.speedValue.textContent = elements.speedInput.value;
  saveSettings();
});
elements.fontInput.addEventListener('input', () => {
  elements.fontValue.textContent = elements.fontInput.value;
  elements.scriptDisplay.style.fontSize = `${elements.fontInput.value}px`;
  saveSettings();
  updatePosition();
});
elements.lineHeightInput.addEventListener('input', () => {
  elements.lineHeightValue.textContent = Number(elements.lineHeightInput.value).toFixed(2);
  elements.scriptDisplay.style.lineHeight = elements.lineHeightInput.value;
  saveSettings();
  updatePosition();
});

elements.stage.addEventListener('scroll', updatePosition, { passive: true });
document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement) document.body.classList.remove('presentation');
});
document.addEventListener('keydown', event => {
  const tag = document.activeElement?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  if (event.code === 'Space') {
    event.preventDefault();
    toggleScrolling();
  } else if (event.code === 'ArrowUp') {
    event.preventDefault();
    elements.speedInput.value = Math.min(100, Number(elements.speedInput.value) + 2);
    elements.speedInput.dispatchEvent(new Event('input'));
  } else if (event.code === 'ArrowDown') {
    event.preventDefault();
    elements.speedInput.value = Math.max(4, Number(elements.speedInput.value) - 2);
    elements.speedInput.dispatchEvent(new Event('input'));
  } else if (event.code === 'ArrowLeft') {
    event.preventDefault();
    jumpToPage(currentPage - 1);
  } else if (event.code === 'ArrowRight') {
    event.preventDefault();
    jumpToPage(currentPage + 1);
  } else if (event.key.toLowerCase() === 'f') {
    toggleFullscreen();
  } else if (event.key.toLowerCase() === 'm') {
    document.body.classList.contains('menu-open') ? closeMenu() : openMenu();
  }
});

async function initialize() {
  script = await window.loadTheaterScript();
  applySettings(loadSettings());
  renderScript();
}

initialize().catch(error => {
  console.error(error);
  elements.scriptDisplay.textContent = 'Der Theatertext konnte nicht geladen werden.';
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js'));
}
