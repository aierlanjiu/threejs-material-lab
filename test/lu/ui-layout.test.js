import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
try {
  for (const width of [1440, 390, 342]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://localhost:8000/index.html?intro=skip', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.luDiagnostics));
    await page.waitForFunction(() => Boolean(window.luBand?.enabled && window.luApplePlayer));

    console.log(`[${width}px] page loaded`);

    // 1. 收起状态：品牌与胶囊无碰撞，旧浮动入口保持隐藏。
    const initial = await page.evaluate(() => {
      const getDisplay = selector => {
        const el = document.querySelector(selector);
        return el ? getComputedStyle(el).display : 'none';
      };
      const capsule = document.querySelector('#performanceCapsule').getBoundingClientRect();
      const header = document.querySelector('.master-deck-hud').getBoundingClientRect();
      const brand = document.querySelector('.brand-section').getBoundingClientRect();
      return {
        capsuleWidth: capsule.width,
        capsuleHeight: capsule.height,
        headerHeight: header.height,
        brandDisplay: getDisplay('.brand-section'),
        brandOverlap: brand.width > 0 && brand.left < capsule.right && brand.right > capsule.left && brand.top < capsule.bottom && brand.bottom > capsule.top,
        capsuleWithinViewport: capsule.left >= 0 && capsule.right <= innerWidth,
        actionsDisplay: getDisplay('.top-actions'),
        handleDisplay: getDisplay('#workbenchHandle'),
        inspectorDockDisplay: getDisplay('#inspectorDockButton'),
        drawerHidden: document.querySelector('#lueCoreDrawer').hidden,
        font: getComputedStyle(document.body).fontFamily
      };
    });

    assert.match(initial.font, /TsangerJinKai02/);
    assert(initial.drawerHidden, 'drawer should start closed');
    assert.equal(initial.brandOverlap, false, `${width}px brand overlaps the core capsule`);
    if (width < 768) assert.equal(initial.brandDisplay, 'none', `${width}px secondary brand should collapse on mobile`);
    assert.equal(initial.actionsDisplay, 'none', `${width}px top actions should be hidden when collapsed`);
    assert.equal(initial.handleDisplay, 'none', `${width}px workbench handle should be hidden when collapsed`);
    assert.equal(initial.inspectorDockDisplay, 'none', `${width}px inspector dock button should be hidden when collapsed`);

    assert(initial.capsuleWithinViewport && initial.capsuleWidth >= 44 && initial.capsuleWidth <= Math.min(260, width - 24), 'core capsule must stay compact and inside the viewport');
    assert(initial.capsuleHeight >= 44 && initial.capsuleHeight <= 56, 'core capsule must retain a touch-sized single row');
    if (width < 768) assert(initial.headerHeight >= 44 && initial.headerHeight <= 64, 'mobile header must remain a single row');
    console.log(`[${width}px] check 1 passed`);

    await page.locator('#performanceCapsule').focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#performanceCapsule').getAttribute('aria-expanded'), 'true', 'Enter should open the core');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#performanceCapsule').getAttribute('aria-expanded'), 'false', 'Escape should close the core');

    // 2. 点击胶囊展开四面律核工作台
    await page.locator('#performanceCapsule').click();
    assert.equal(await page.locator('#performanceCapsule').getAttribute('aria-expanded'), 'true');
    assert.equal(await page.locator('#lueCoreDrawer').evaluate(el => el.hidden), false);
    assert.equal(await page.locator('#workbenchHandle').isVisible(), false, 'old workbench handle should remain hidden');
    assert.equal(await page.locator('#inspectorDockButton').isVisible(), false, 'old inspector handle should remain hidden');

    // 当前抽屉允许完整编舞卡片，但须留出播放器和视口安全区。
    if (width < 768) {
      const drawerHeight = await page.locator('#lueCoreDrawer').evaluate(el => el.getBoundingClientRect().height);
      assert(drawerHeight <= Math.min(520, 900 - 190), `drawer exceeds its safe height: ${drawerHeight}px`);
    }
    console.log(`[${width}px] check 2 passed`);

    // 3. 切换演出面与工作台交互
    await page.locator('#lueTabChoreo').click();
    assert.equal(await page.locator('#lueFacetChoreo').evaluate(el => !el.hidden), true);
    assert.equal(await page.locator('#workbenchDock').evaluate(el => el.inert), false);
    console.log(`[${width}px] check 3 passed`);

    // 4. 切换创作面并打开检查器面板
    await page.locator('#lueTabCreate').click();
    assert.equal(await page.locator('#lueFacetCreate').evaluate(el => !el.hidden), true);
    await page.locator('#inspectorToggleBtn').click();
    assert.equal(await page.locator('#inspectorPanel').evaluate(el => !el.classList.contains('collapsed')), true);
    assert.equal(await page.locator('#lueCoreDrawer').evaluate(el => el.hidden), true, 'deep editor should replace the quick drawer');
    await page.locator('#inspectorCloseBtn').click();
    assert.equal(await page.locator('#inspectorPanel').evaluate(el => el.classList.contains('collapsed')), true);
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'performanceCapsule');
    console.log(`[${width}px] check 4 passed`);

    // 5. 按 Escape 键收起工作台并让焦点回到胶囊
    await page.locator('#performanceCapsule').click();
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#lueCoreDrawer').evaluate(el => el.hidden), true);
    assert.equal(await page.locator('#performanceCapsule').getAttribute('aria-expanded'), 'false');
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'performanceCapsule');
    console.log(`[${width}px] check 5 passed`);

    // 6. 沉浸模式测试
    if (width < 768) {
      await page.keyboard.press('f');
      await page.waitForFunction(() => document.body.classList.contains('immersive') && document.querySelector('#performanceCapsuleLabel')?.textContent === '退出沉浸');
      console.log(`[${width}px] entered immersive`);
      await page.waitForTimeout(200);
      const immersive = await page.evaluate(() => {
        const rect = document.querySelector('#stageWrap').getBoundingClientRect();
        const capsule = document.querySelector('#performanceCapsule').getBoundingClientRect();
        return {
          capsuleWidth: capsule.width,
          capsuleHeight: capsule.height,
          capsuleLabel: document.querySelector('#performanceCapsuleLabel').textContent,
          bodyPadding: getComputedStyle(document.body).padding,
          stage: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
          viewport: { width: innerWidth, height: innerHeight }
        };
      });
      console.log(`[${width}px] immersive measured:`, JSON.stringify(immersive));
      assert(immersive.capsuleWidth >= 44 && immersive.capsuleWidth <= Math.min(260, width - 24), 'immersive exit must remain compact');
      assert(Math.abs(immersive.capsuleHeight - 36) < 4, 'immersive exit must retain its compact 36px treatment');
      assert.equal(immersive.capsuleLabel, '退出沉浸');
      assert.deepEqual(immersive.stage, { x: 0, y: 0, ...immersive.viewport }, 'stage should fill mobile viewport');

      // 点击胶囊退出沉浸模式
      await page.waitForTimeout(200);
      await page.locator('#performanceCapsule').click();
      await page.waitForFunction(() => !document.body.classList.contains('immersive'));
      assert.equal(await page.locator('#performanceCapsule').isVisible(), true, 'capsule returns to standard state');
      console.log(`[${width}px] exited immersive`);
    }

    if (width === 390) {
      await page.locator('#performanceCapsule').click();
      await page.locator('#lueTabCreate').click();
      await page.locator('#lueOpenMatrixBtn').click();
      await page.locator('#presetBgSelect').selectOption('studio/alpine-light-background-v1.png');
      await page.waitForFunction(() => !document.body.classList.contains('poster-mode'));
      await page.locator('#inspectorCloseBtn').click();
      assert.equal(await page.evaluate(() => document.activeElement?.id), 'performanceCapsule');
      assert.equal(await page.locator('#performanceCapsule').isVisible(), true, 'core must survive a non-poster wallpaper');
      await page.locator('#performanceCapsule').click();
      await page.locator('#lueTabRecord').click();
      assert.equal(await page.locator('#lueFacetRecord').evaluate(el => !el.hidden), true);
      await page.keyboard.press('Escape');
      console.log('[390px] non-poster wallpaper entrance passed');
    }

    assert.deepEqual(errors, [], `${width}px browser errors: ${errors.join('; ')}`);
    console.log(`UI layout and LÜ Core entrance ${width}px PASS`);
    await page.close();
  }
} finally {
  await browser.close();
}
