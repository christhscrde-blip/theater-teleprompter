const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const URL = process.env.TEST_URL || 'http://127.0.0.1:4173/?acceptance=v10';

async function waitForApp(page) {
  await page.waitForFunction(() => {
    const state = window.__TELEPROMPTER__?.getState?.();
    return state?.version === 10 && state?.paragraphs === 1457 && state?.currentPage === 1;
  }, null, { timeout: 15000 });
}

async function readState(page) {
  const serialized = await page.evaluate(() => JSON.stringify(window.__TELEPROMPTER__.getState()));
  return JSON.parse(serialized);
}

async function setRange(page, selector, value) {
  await page.locator(selector).evaluate((element, next) => {
    element.value = String(next);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}

async function openDevice(browser, name, viewport) {
  const context = await browser.newContext({ viewport, serviceWorkers: 'allow' });
  await context.addInitScript(() => {
    try {
      Object.defineProperty(Document.prototype, 'fullscreenEnabled', {
        configurable: true,
        get: () => false,
      });
    } catch {}
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  const response = await page.goto(URL, { waitUntil: 'networkidle' });
  assert.equal(response.status(), 200, `${name}: HTTP status`);
  await waitForApp(page);
  return { context, page, errors };
}

async function assertCore(page, name) {
  const state = await readState(page);
  assert.deepEqual(
    [state.version, state.title, state.paragraphs, state.pages, state.acts, state.scenes, state.currentPage],
    [10, 'Die Räuber', 1457, 63, 5, 15, 1],
    `${name}: exact initial state`,
  );
  assert.equal(await page.getByText('Fehler beim Laden').count(), 0, `${name}: no loading error`);
  assert.equal(await page.locator('.script-line').count(), 1457, `${name}: all paragraphs rendered`);
  assert.equal(await page.locator('.script-line').first().textContent(), 'FRIEDRICH SCHILLER');
  assert.equal(await page.locator('.script-line').last().textContent(), 'ENDE');
}

async function assertPresentation(page, name) {
  await page.locator('#fullscreenButton').click();
  await page.waitForFunction(() => window.__TELEPROMPTER__.getState().presentation === true);
  const exit = page.locator('#presentationExitButton');
  await exit.waitFor({ state: 'visible' });
  await exit.click();
  await page.waitForFunction(() => window.__TELEPROMPTER__.getState().presentation === false);
  assert.equal(await exit.isVisible(), false, `${name}: exit control hides after leaving`);
}

async function testDesktop(browser) {
  const { context, page, errors } = await openDevice(browser, 'desktop', { width: 1440, height: 900 });
  await assertCore(page, 'desktop');

  assert.equal(await page.locator('.nav-link').count(), 5, 'desktop: five acts');
  await page.locator('[data-nav="scenes"]').click();
  assert.equal(await page.locator('.nav-link').count(), 15, 'desktop: fifteen scenes');
  await page.locator('[data-nav="pages"]').click();
  assert.equal(await page.locator('.nav-link').count(), 64, 'desktop: title plus 63 pages');

  await page.locator('#pageInput').fill('63');
  await page.locator('#pageJumpButton').click();
  await page.waitForFunction(() => window.__TELEPROMPTER__.getState().currentPage === 63);
  assert.equal(await page.locator('#pageText').textContent(), 'Seite 63');
  assert.equal(await page.locator('.script-line.end').textContent(), 'ENDE');

  await page.locator('#previousPageButton').click();
  await page.waitForFunction(() => window.__TELEPROMPTER__.getState().currentPage === 62);
  await page.locator('#nextPageButton').click();
  await page.waitForFunction(() => window.__TELEPROMPTER__.getState().currentPage === 63);

  await page.evaluate(() => window.__TELEPROMPTER__.jumpToPage(1));
  await page.waitForTimeout(100);
  const before = await page.locator('#stage').evaluate(element => element.scrollTop);
  await page.locator('#playButton').click();
  await page.waitForTimeout(900);
  const after = await page.locator('#stage').evaluate(element => element.scrollTop);
  assert(after > before + 5, `desktop: auto-scroll ${before} -> ${after}`);
  await page.locator('#playButton').click();

  await setRange(page, '#speedInput', 50);
  await setRange(page, '#fontInput', 54);
  await setRange(page, '#lineHeightInput', 1.7);
  assert.equal(await page.locator('#speedValue').textContent(), '50');
  assert.equal(await page.locator('#fontValue').textContent(), '54');
  assert.equal(await page.locator('#lineHeightValue').textContent(), '1.70');
  assert.equal(await page.locator('#scriptDisplay').evaluate(element => element.style.fontSize), '54px');

  await page.locator('#themeButton').click();
  assert.equal(await page.locator('body').evaluate(element => element.classList.contains('dark')), false);
  await page.locator('#themeButton').click();
  await assertPresentation(page, 'desktop');

  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => window.__TELEPROMPTER__.getState().currentPage === 2);
  await page.keyboard.press('ArrowLeft');
  await page.waitForFunction(() => window.__TELEPROMPTER__.getState().currentPage === 1);
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.__TELEPROMPTER__.getState().isPlaying === true);
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.__TELEPROMPTER__.getState().isPlaying === false);

  await page.reload({ waitUntil: 'networkidle' });
  await waitForApp(page);
  assert.equal(await page.locator('#speedValue').textContent(), '50');
  assert.equal(await page.locator('#fontValue').textContent(), '54');

  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await waitForApp(page);
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 10000 });
  await waitForApp(page);
  assert.equal((await readState(page)).paragraphs, 1457, 'desktop: full offline data');
  await context.setOffline(false);

  assert.deepEqual(errors, [], 'desktop: no browser errors');
  await context.close();
}

async function testMobile(browser, name, viewport) {
  const { context, page, errors } = await openDevice(browser, name, viewport);
  await assertCore(page, name);

  await page.locator('#menuButton').click();
  assert(await page.locator('body').evaluate(element => element.classList.contains('menu-open')), `${name}: menu opens`);
  await page.locator('#closeMenuButton').click();
  assert.equal(await page.locator('body').evaluate(element => element.classList.contains('menu-open')), false, `${name}: menu closes`);

  await page.locator('#pageInput').fill('63');
  await page.locator('#pageJumpButton').click();
  await page.waitForFunction(() => window.__TELEPROMPTER__.getState().currentPage === 63);
  await assertPresentation(page, name);

  assert.deepEqual(errors, [], `${name}: no browser errors`);
  await context.close();
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    await testDesktop(browser);
    await testMobile(browser, 'iPad', { width: 820, height: 1180 });
    await testMobile(browser, 'iPhone', { width: 390, height: 844 });
    console.log('Version 10 acceptance passed on desktop, iPad and iPhone.');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exit(1);
});
