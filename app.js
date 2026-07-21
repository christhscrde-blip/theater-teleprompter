const elements = {
  setupPanel: document.querySelector('#setupPanel'),
  prompterPanel: document.querySelector('#prompterPanel'),
  scriptInput: document.querySelector('#scriptInput'),
  fileInput: document.querySelector('#fileInput'),
  loadButton: document.querySelector('#loadButton'),
  demoButton: document.querySelector('#demoButton'),
  clearButton: document.querySelector('#clearButton'),
  editButton: document.querySelector('#editButton'),
  scriptDisplay: document.querySelector('#scriptDisplay'),
  sceneList: document.querySelector('#sceneList'),
  stage: document.querySelector('#stage'),
  playButton: document.querySelector('#playButton'),
  rewindButton: document.querySelector('#rewindButton'),
  forwardButton: document.querySelector('#forwardButton'),
  speedInput: document.querySelector('#speedInput'),
  speedValue: document.querySelector('#speedValue'),
  fontInput: document.querySelector('#fontInput'),
  fontValue: document.querySelector('#fontValue'),
  themeButton: document.querySelector('#themeButton'),
  fullscreenButton: document.querySelector('#fullscreenButton'),
  statusText: document.querySelector('#statusText'),
  progressText: document.querySelector('#progressText')
};

const STORAGE_KEY = 'theater-teleprompter-state-v1';
const demoScript = `AKT 1
SZENE 1 – Hinter der Bühne

ERZÄHLER: Der Vorhang schweigt. Noch.

MARA: Sind wirklich alle bereit?

(Es rumpelt verdächtig hinter dem Vorhang.)

JONAS: Technisch gesehen fehlt nur noch die Technik.

MARA: Das ist beim Theater traditionell der Moment, in dem man trotzdem anfängt.

SZENE 2 – Auf der Bühne

ERZÄHLER: Das Licht geht an. Niemand weiß genau, warum.

JONAS: Willkommen zu einem Abend, an dem garantiert fast alles geplant ist.`;

let animationFrame = null;
let lastFrameTime = 0;
let isPlaying = false;
let sceneTargets = [];

function loadStoredState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? {};
  } catch {
    return {};
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    script: elements.scriptInput.value,
    speed: Number(elements.speedInput.value),
    fontSize: Number(elements.fontInput.value),
    dark: document.body.classList.contains('dark')
  }));
}

function classifyLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return 'blank';
  if (/^(AKT|SZENE|PROLOG|EPILOG|PAUSE)\b/i.test(trimmed)) return 'heading';
  if (/^\(.+\)$/.test(trimmed) || /^\[.+\]$/.test(trimmed)) return 'direction';
  if (/^[A-ZÄÖÜẞ][A-ZÄÖÜẞ0-9 .'-]{1,30}:/.test(trimmed)) return 'speaker';
  return 'dialogue';
}

function renderScript(text) {
  elements.scriptDisplay.replaceChildren();
  elements.sceneList.replaceChildren();
  sceneTargets = [];

  const fragment = document.createDocumentFragment();
  text.replace(/\r\n/g, '\n').split('\n').forEach((line, index) => {
    const paragraph = document.createElement('p');
    const type = classifyLine(line);
    paragraph.className = `script-line ${type}`;
    paragraph.textContent = line || ' ';
    paragraph.dataset.line = String(index + 1);

    if (type === 'heading') {
      paragraph.id = `scene-${sceneTargets.length}`;
      sceneTargets.push(paragraph);

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'scene-link';
      button.textContent = line.trim();
      button.addEventListener('click', () => {
        stopScrolling();
        elements.stage.scrollTo({ top: paragraph.offsetTop - elements.stage.clientHeight * 0.35, behavior: 'smooth' });
      });
      elements.sceneList.append(button);
    }

    fragment.append(paragraph);
  });

  elements.scriptDisplay.append(fragment);
  if (!sceneTargets.length) {
    const note = document.createElement('p');
    note.className = 'script-line direction';
    note.textContent = 'Keine Szenenüberschriften erkannt. Verwende zum Beispiel „AKT 1“ oder „SZENE 2“.';
    elements.sceneList.append(note);
  }
  updateProgress();
}

function openPrompter() {
  const text = elements.scriptInput.value.trim();
  if (!text) {
    elements.scriptInput.focus();
    elements.scriptInput.setAttribute('placeholder', 'Hier muss tatsächlich Text hinein. Der Teleprompter ist noch nicht telepathisch.');
    return;
  }
  renderScript(text);
  elements.setupPanel.classList.add('hidden');
  elements.prompterPanel.classList.remove('hidden');
  elements.stage.scrollTop = 0;
  elements.stage.focus();
  saveState();
}

function editScript() {
  stopScrolling();
  elements.prompterPanel.classList.add('hidden');
  elements.setupPanel.classList.remove('hidden');
  elements.scriptInput.focus();
}

function setPlaying(nextState) {
  isPlaying = nextState;
  elements.playButton.textContent = isPlaying ? 'Pause' : 'Start';
  elements.statusText.textContent = isPlaying ? 'Läuft' : 'Pausiert';
  if (isPlaying) {
    lastFrameTime = performance.now();
    animationFrame = requestAnimationFrame(scrollStep);
  } else if (animationFrame) {
    cancelAnimationFrame(animationFrame);
    animationFrame = null;
  }
}

function toggleScrolling() {
  if (elements.stage.scrollTop >= elements.stage.scrollHeight - elements.stage.clientHeight - 2) {
    elements.stage.scrollTop = 0;
  }
  setPlaying(!isPlaying);
}

function stopScrolling() {
  if (isPlaying) setPlaying(false);
}

function scrollStep(timestamp) {
  if (!isPlaying) return;
  const deltaSeconds = Math.min((timestamp - lastFrameTime) / 1000, 0.05);
  lastFrameTime = timestamp;
  const pixelsPerSecond = Number(elements.speedInput.value);
  elements.stage.scrollTop += pixelsPerSecond * deltaSeconds;
  updateProgress();

  const atEnd = elements.stage.scrollTop >= elements.stage.scrollHeight - elements.stage.clientHeight - 1;
  if (atEnd) {
    setPlaying(false);
    elements.statusText.textContent = 'Ende erreicht';
    return;
  }
  animationFrame = requestAnimationFrame(scrollStep);
}

function skip(seconds) {
  const distance = Number(elements.speedInput.value) * seconds;
  elements.stage.scrollBy({ top: distance, behavior: 'smooth' });
  window.setTimeout(updateProgress, 300);
}

function updateProgress() {
  const maxScroll = Math.max(elements.stage.scrollHeight - elements.stage.clientHeight, 1);
  const progress = Math.min(100, Math.max(0, elements.stage.scrollTop / maxScroll * 100));
  elements.progressText.textContent = `${Math.round(progress)} %`;

  let activeIndex = -1;
  const focusLine = elements.stage.scrollTop + elements.stage.clientHeight * 0.38;
  sceneTargets.forEach((target, index) => {
    if (target.offsetTop <= focusLine) activeIndex = index;
  });
  document.querySelectorAll('.scene-link').forEach((button, index) => {
    button.classList.toggle('active', index === activeIndex);
  });
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
  saveState();
}

elements.loadButton.addEventListener('click', openPrompter);
elements.editButton.addEventListener('click', editScript);
elements.playButton.addEventListener('click', toggleScrolling);
elements.rewindButton.addEventListener('click', () => skip(-10));
elements.forwardButton.addEventListener('click', () => skip(10));
elements.themeButton.addEventListener('click', toggleTheme);
elements.fullscreenButton.addEventListener('click', toggleFullscreen);
elements.demoButton.addEventListener('click', () => {
  elements.scriptInput.value = demoScript;
  saveState();
});
elements.clearButton.addEventListener('click', () => {
  elements.scriptInput.value = '';
  saveState();
  elements.scriptInput.focus();
});

elements.fileInput.addEventListener('change', async event => {
  const [file] = event.target.files;
  if (!file) return;
  elements.scriptInput.value = await file.text();
  saveState();
});

elements.speedInput.addEventListener('input', () => {
  elements.speedValue.textContent = elements.speedInput.value;
  saveState();
});
elements.fontInput.addEventListener('input', () => {
  elements.fontValue.textContent = elements.fontInput.value;
  elements.scriptDisplay.style.fontSize = `${elements.fontInput.value}px`;
  saveState();
});
elements.stage.addEventListener('scroll', updateProgress, { passive: true });
document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement) document.body.classList.remove('presentation');
});
document.addEventListener('keydown', event => {
  const editing = document.activeElement === elements.scriptInput;
  if (editing) return;
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
    skip(-10);
  } else if (event.code === 'ArrowRight') {
    skip(10);
  } else if (event.key.toLowerCase() === 'f') {
    toggleFullscreen();
  }
});

const stored = loadStoredState();
elements.scriptInput.value = stored.script || '';
elements.speedInput.value = stored.speed || 24;
elements.fontInput.value = stored.fontSize || 46;
elements.speedValue.textContent = elements.speedInput.value;
elements.fontValue.textContent = elements.fontInput.value;
elements.scriptDisplay.style.fontSize = `${elements.fontInput.value}px`;
if (stored.dark) {
  document.body.classList.add('dark');
  elements.themeButton.textContent = 'Heller Modus';
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js'));
}
