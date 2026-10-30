import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const baseURL = process.env.LU_TEST_BASE_URL || 'http://localhost:8000';
const deadline = setTimeout(() => {
  console.error('FAIL: menu/mode regression did not finish within 90 seconds');
  process.exit(1);
}, 90_000);
const browser = await chromium.launch({ headless: true, channel: process.env.LU_TEST_BROWSER || undefined });
let checks = 0;
try {
  for (const width of [1440, 390, 342]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    page.setDefaultTimeout(8000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${baseURL}/index.html?intro=skip`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.luDiagnostics && window.luApplePlayer), null, { timeout: 20_000, polling: 50 }).catch(async error => {
      console.error('Initialization errors:', errors);
      console.error('Initialization state:', await page.evaluate(() => ({
        title: document.title, body: document.body.className,
        diagnostics: Boolean(window.luDiagnostics), band: Boolean(window.luBand)
      })));
      throw error;
    });
    const blockedButtons = await page.locator('#luAppleDock button:not([hidden])').evaluateAll(buttons => buttons.filter(button => {
      const rect = button.getBoundingClientRect();
      if (!rect.width || !rect.height) return false;
      return !button.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
    }).map(button => button.id));
    assert.deepEqual(blockedButtons, [], `${width}px dock buttons overlap or are blocked`);
    const capsule = page.locator('#performanceCapsule');
    const drawer = page.locator('#lueCoreDrawer');
    await page.evaluate(() => {
      window.menuClassMutations = 0;
      new MutationObserver(records => { window.menuClassMutations += records.length; })
        .observe(document.body, { attributes: true, attributeFilter: ['class'] });
    });

    // Real input must finish, the drawer must paint, and the event loop must stay responsive.
    for (let attempt = 0; attempt < 3; attempt++) {
      await capsule.click({ force: true });
      await drawer.waitFor({ state: 'visible' });
      assert.equal(await capsule.getAttribute('aria-expanded'), 'true');
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      assert(await page.evaluate(() => window.menuClassMutations < 30), 'opening the menu repeatedly rewrites body.class');
      await page.locator('#lueDrawerCloseBtn').click();
      await drawer.waitFor({ state: 'hidden' });
      assert.equal(await capsule.getAttribute('aria-expanded'), 'false');
      checks++;
    }
    await capsule.press('Enter');
    await drawer.waitFor({ state: 'visible' });
    await page.keyboard.press('Escape');
    await drawer.waitFor({ state: 'hidden' });
    checks++;

    // The single button must cycle real engine state as well as label and colored icon.
    assert.equal(await page.evaluate(() => window.kineticLyricsManager.mode), 'band', 'a fresh visit defaults to band');
    const expectedLabels = { off: '纯享', slot: '机械魔方', gravity: '反重力', band: '乐队' };
    for (const mode of ['off', 'slot', 'gravity', 'band']) {
      await page.locator('#appleModeBtn').click();
      await page.waitForFunction(expected => window.kineticLyricsManager.mode === expected, mode, { polling: 50 });
      assert.equal(await page.locator('#appleModeBtn').getAttribute('data-mode'), mode);
      assert.equal(await page.locator('#appleModeLabel').textContent(), expectedLabels[mode]);
      const visibleIcons = await page.locator('#appleModeBtn .lu-apple-mode-icon').evaluateAll(icons => icons
        .filter(icon => getComputedStyle(icon).display !== 'none').map(icon => icon.dataset.iconMode));
      assert.deepEqual(visibleIcons, [mode]);
      const palette = await page.locator(`#appleModeBtn [data-icon-mode="${mode}"]`).evaluate(icon => {
        const colors = [...icon.querySelectorAll('path, rect, circle, ellipse, polygon, line')]
          .flatMap(shape => [getComputedStyle(shape).fill, getComputedStyle(shape).stroke]);
        return [...new Set(colors.filter(color => color !== 'none' && color !== 'rgba(0, 0, 0, 0)'))];
      });
      assert(palette.length >= 3, `${mode} icon lost its distinct colors: ${palette}`);
      checks++;
    }

    await capsule.click();
    await page.locator('#lueTabChoreo').click();
    await page.waitForFunction(() => getComputedStyle(document.querySelector('#lueFacetChoreo')).opacity === '1', null, { polling: 50 });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const modeRows = await page.locator('#kineticModeSwitcher .kinetic-mode-btn').evaluateAll(buttons => buttons.map(button => button.getBoundingClientRect().top));
    assert(Math.max(...modeRows) - Math.min(...modeRows) < 2, 'all four colored mode buttons should fit one row');
    if (process.env.LU_TEST_ARTIFACTS) {
      await page.screenshot({ path: `${process.env.LU_TEST_ARTIFACTS}/menu-${width}px.png` });
    }
    await page.locator('#kineticModeSwitcher [data-mode="off"]').click();
    assert.equal(await page.locator('#appleModeBtn').getAttribute('data-mode'), 'off', 'drawer mode updates the dock');
    await page.locator('#lueDrawerCloseBtn').click();
    await capsule.click();
    const drawerBounds = await drawer.boundingBox();
    await page.mouse.click(width - 12, drawerBounds.y + drawerBounds.height + 24);
    await drawer.waitFor({ state: 'hidden' });
    checks++;

    // The class-write guard must still allow the playing dock to hide and wake.
    await page.locator('#applePlayPauseBtn').click();
    await page.waitForFunction(() => window.state.isPlayingMusic && window.state.audioReady, null, { polling: 50 });
    await page.mouse.move(width - 24, 500);
    await page.waitForFunction(() => document.querySelector('#luAppleDock').dataset.visibility === 'hidden', null, { polling: 50 });
    assert(await page.evaluate(() => document.body.classList.contains('apple-dock-hidden')));
    await page.mouse.move(width - 48, 500);
    await page.waitForFunction(() => document.querySelector('#luAppleDock').dataset.visibility === 'visible', null, { polling: 50 });
    assert.equal(await page.evaluate(() => document.body.classList.contains('apple-dock-hidden')), false);
    await capsule.click();
    await drawer.waitFor({ state: 'visible' });
    await page.locator('#appleStopBtn').click();
    checks++;

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    assert.equal(overflow, false, `${width}px view has horizontal overflow`);
    assert.deepEqual(errors, [], 'page raised a JavaScript error');
    console.log(`PASS ${width}px: menu, keyboard, four colored modes, drawer sync, outside click and playing dock hide/wake`);
    await context.close();
  }
  console.log(`PASS: ${checks} menu/mode regression checks`);
} finally {
  await browser.close();
  clearTimeout(deadline);
}
