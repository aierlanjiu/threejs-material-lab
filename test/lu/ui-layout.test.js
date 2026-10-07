import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
try {
  for (const width of [1440, 342]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://localhost:8000/index.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.luDiagnostics));
    const initial = await page.evaluate(() => {
      const rect = selector => document.querySelector(selector).getBoundingClientRect().toJSON();
      return {
        brand: rect('.brand-section'), actions: rect('.top-actions'),
        controls: rect('.deck-controls'), rail: rect('.time-rail-wrap'),
        mode: rect('.kinetic-mode-switcher'), handle: rect('#workbenchHandle'),
        font: getComputedStyle(document.body).fontFamily,
        dockHidden: document.querySelector('#workbenchDock').inert,
        inspectorHidden: document.querySelector('#inspectorPanel').inert
      };
    });
    const overlaps = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    assert(!overlaps(initial.brand, initial.actions), `${width}px brand/actions overlap`);
    assert(!overlaps(initial.controls, initial.rail), `${width}px player controls/rail overlap`);
    assert(!overlaps(initial.mode, initial.handle), `${width}px mode/handle overlap`);
    assert.match(initial.font, /TsangerJinKai02/);
    assert(initial.dockHidden && initial.inspectorHidden, 'workspace controls should start closed');
    await page.locator('#workbenchHandle').click();
    assert.equal(await page.locator('#workbenchHandle').getAttribute('aria-expanded'), 'true');
    assert.equal(await page.locator('#workbenchDock').evaluate(element => element.inert), false);
    await page.locator('#inspectorDockButton').click();
    assert.equal(await page.locator('#inspectorPanel').evaluate(element => element.inert), false);
    await page.locator('#inspectorCloseBtn').click();
    assert.equal(await page.locator('#inspectorPanel').evaluate(element => element.inert), true);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#workbenchDock').evaluate(element => element.inert), true);
    assert.equal(await page.locator('#inspectorPanel').evaluate(element => element.inert), true);
    if (width === 342) {
      for (const nativeFullscreen of [true, false]) {
        if (!nativeFullscreen) await page.locator('#stageCell').evaluate(element => { element.requestFullscreen = undefined; });
        await page.locator('#immersiveToggle').click();
        await page.waitForFunction(() => document.body.classList.contains('immersive'));
        const immersive = await page.evaluate(() => {
          const rect = document.querySelector('#stageWrap').getBoundingClientRect();
          return {
            header: getComputedStyle(document.querySelector('.master-deck-hud')).display,
            dock: getComputedStyle(document.querySelector('.bottom-dynamic-dock')).display,
            bodyPadding: getComputedStyle(document.body).padding,
            stage: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
            viewport: { width: innerWidth, height: innerHeight }
          };
        });
        assert.equal(immersive.header, 'none', 'top controls should hide in immersive mode');
        assert.equal(immersive.dock, 'none', 'workspace dock should hide in immersive mode');
        assert.equal(immersive.bodyPadding, '0px');
        assert.deepEqual(immersive.stage, { x: 0, y: 0, ...immersive.viewport }, 'stage should fill the mobile viewport');
        assert.equal(await page.locator('#immersiveToggle').isVisible(), true, 'return button should stay visible');
        await page.locator('#immersiveToggle').click();
        await page.waitForFunction(() => !document.body.classList.contains('immersive'));
        assert.equal(await page.locator('.master-deck-hud').isVisible(), true, 'top controls should return');
        const aspect = await page.locator('#stageWrap').evaluate(element => {
          const rect = element.getBoundingClientRect();
          return rect.width / rect.height;
        });
        assert(Math.abs(aspect - 9 / 16) < 0.01, 'portrait preview should return after immersive mode');
      }
    }
    assert.deepEqual(errors, [], `${width}px browser errors: ${errors.join('; ')}`);
    console.log(`UI layout and drawer controls ${width}px PASS`);
    await page.close();
  }
} finally {
  await browser.close();
}
