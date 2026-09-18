import { chromium } from 'playwright';
import assert from 'node:assert/strict';

async function clickPieceAt(page, row, col) {
  const point = await page.evaluate(({ row, col }) => {
    const piece = window.app.state.pieces.find(item => item.row === row && item.col === col);
    const mesh = window.app.board3D.pieceMeshes.get(piece.id);
    const projected = mesh.position.clone().project(window.app.board3D.camera);
    const rect = window.app.board3D.renderer.domElement.getBoundingClientRect();
    return {
      x: rect.left + (projected.x + 1) * rect.width / 2,
      y: rect.top + (1 - projected.y) * rect.height / 2,
    };
  }, { row, col });
  await page.mouse.click(point.x, point.y);
}

async function clickLegalTarget(page, row, col, offset = { x: 0, z: 0 }) {
  const point = await page.evaluate(({ row, col, offset }) => {
    const dot = window.app.board3D.legalMoveDots.find(item => item.userData.row === row && item.userData.col === col);
    const target = dot.position.clone();
    target.x += offset.x;
    target.z += offset.z;
    const projected = target.project(window.app.board3D.camera);
    const rect = window.app.board3D.renderer.domElement.getBoundingClientRect();
    return {
      x: rect.left + (projected.x + 1) * rect.width / 2,
      y: rect.top + (1 - projected.y) * rect.height / 2,
    };
  }, { row, col, offset });
  await page.mouse.click(point.x, point.y);
}

async function runE2E() {
  console.log('Starting Playwright E2E Verification...');
  const browser = await chromium.launch({ headless: true });

  // 1. Desktop Viewport (1440 x 1000)
  console.log('--- Testing Desktop Viewport (1440x1000) ---');
  const desktopPage = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const desktopErrors = [];
  desktopPage.on('console', msg => {
    if (msg.type() === 'error') desktopErrors.push(msg.text());
  });

  await desktopPage.goto('http://127.0.0.1:8000/xiangqi.html', { waitUntil: 'networkidle' });
  await desktopPage.waitForTimeout(1500);

  // Check no horizontal scrollbar / overflow
  const desktopOverflow = await desktopPage.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });
  assert.equal(desktopOverflow, false, 'Desktop width should not overflow horizontally');

  // Verify Title and Canvas present
  const title = await desktopPage.title();
  assert.ok(title.includes('弈界'), 'Page title should include 弈界');
  const canvasCount = await desktopPage.locator('#stage3d canvas').count();
  assert.equal(canvasCount, 1, '3D Canvas should exist');

  // Check Status text
  let statusText = await desktopPage.locator('#statusText').textContent();
  console.log('Engine status badge:', statusText);

  // Screenshot desktop initial
  await desktopPage.screenshot({ path: 'output/playwright/desktop-1440-final.png' });

  // Verify the Xuemu illustration event layer used for capture points and decisive moments.
  await desktopPage.evaluate(() => window.app.showBattleEvent({
    actor: { color: 'red', type: 'horse' },
    kind: 'major', kicker: '战果', title: '击破 · 車', detail: '+9 高价值目标', duration: 1200
  }));
  await desktopPage.waitForSelector('#battleEvent.visible');
  assert.ok((await desktopPage.getAttribute('#battleEventPortrait', 'src')).includes('portraits/red-horse.png'), 'Battle event should use the Xuemu portrait set');
  await desktopPage.screenshot({ path: 'output/playwright/desktop-capture-event.png' });
  await desktopPage.waitForTimeout(1300);

  await desktopPage.selectOption('#modeSelect', 'pvp');
  await desktopPage.evaluate(() => {
    const pawn = window.app.state.pieces.find(p => p.color === 'red' && p.type === 'soldier' && p.row === 6 && p.col === 0);
    pawn.row = 4;
    window.app.board3D.renderState(window.app.state);
    window.app.handleHumanMove(pawn, { row: 3, col: 0 });
  });
  await desktopPage.waitForFunction(() => document.querySelector('#redScore')?.textContent === '1');
  assert.equal(await desktopPage.textContent('#redCaptures'), '1 枚', 'A real capture should update the score ledger');
  await desktopPage.click('#newGameBtn');
  await desktopPage.selectOption('#modeSelect', 'pve');

  // 2. Test Player Move -> AI Response -> Undo
  console.log('--- Testing Player Move & AI Interaction ---');
  // Trigger click on Canvas to select a piece (e.g. Red Cannon or Pawn)
  const canvasBounding = await desktopPage.locator('#stage3d canvas').boundingBox();
  assert.ok(canvasBounding, 'Canvas bounding box must exist');

  // Click center-ish to interact
  await desktopPage.mouse.click(canvasBounding.x + canvasBounding.width * 0.5, canvasBounding.y + canvasBounding.height * 0.65);
  await desktopPage.waitForTimeout(500);

  // Test New Game button
  await desktopPage.click('#newGameBtn');
  await desktopPage.waitForTimeout(500);

  // Execute a real player move through the app controller, wait for Wukong response, then undo both plies.
  await desktopPage.selectOption('#levelSelect', '1');
  await desktopPage.evaluate(() => {
    const pawn = window.app.state.pieces.find(p => p.color === 'red' && p.type === 'soldier' && p.row === 6 && p.col === 0);
    window.app.handleHumanMove(pawn, { row: 5, col: 0 });
  });
  await desktopPage.waitForFunction(() => window.app.state.history.length >= 2, null, { timeout: 10000 });
  assert.ok(await desktopPage.evaluate(() => window.app.state.history.length >= 2), 'Player move must receive a real AI response');
  await desktopPage.click('#undoBtn');
  await desktopPage.waitForFunction(() => window.app.state.history.length === 0);

  // Test Mode Selection (Switch to PvP)
  await desktopPage.selectOption('#modeSelect', 'pvp');
  await desktopPage.waitForTimeout(500);

  // Regression: advisor must select and move diagonally inside the palace.
  // Click 0.30 world units off-centre to verify touch-friendly hit tolerance.
  await desktopPage.click('#newGameBtn');
  await clickPieceAt(desktopPage, 9, 3);
  await desktopPage.waitForFunction(() => window.app.board3D.selectedPiece?.type === 'advisor');
  assert.ok(await desktopPage.evaluate(() => window.app.board3D.legalMoveDots.some(dot => dot.userData.row === 8 && dot.userData.col === 4)), 'Advisor diagonal destination must be offered');
  await clickLegalTarget(desktopPage, 8, 4, { x: 0.3, z: 0 });
  await desktopPage.waitForFunction(() => window.app.state.history.length === 1);
  assert.equal(await desktopPage.evaluate(() => window.app.state.pieces.find(piece => piece.id === 7)?.row), 8, 'Advisor must move diagonally with a tolerant tap target');

  // A pinned advisor may have a pseudo destination that is illegal because it
  // would become the screen for an enemy cannon. Explain this instead of
  // silently showing no dots and making the desktop page look broken.
  await desktopPage.evaluate(() => {
    window.app.mode = 'pvp';
    window.app.startNewGame({
      pieces: [
        { id: 1, type: 'general', color: 'black', row: 0, col: 4 },
        { id: 2, type: 'cannon', color: 'black', row: 5, col: 4 },
        { id: 3, type: 'general', color: 'red', row: 9, col: 4 },
        { id: 4, type: 'advisor', color: 'red', row: 9, col: 3 },
      ],
      turn: 'red', history: [], lastMove: null,
    });
  });
  await clickPieceAt(desktopPage, 9, 3);
  await desktopPage.waitForFunction(() => document.querySelector('#toast')?.textContent.includes('会让己方将帅受将'));
  assert.equal(await desktopPage.evaluate(() => window.app.board3D.legalMoveDots.length), 0, 'Pinned advisor must not expose an illegal destination');
  await desktopPage.screenshot({ path: 'output/playwright/desktop-pinned-advisor-explanation.png' });

  // Regression: click the red cannon, then the centre of the black horse.
  // The cannon capture is legal with the black cannon at (2,1) as its screen.
  await desktopPage.click('#newGameBtn');
  await desktopPage.waitForFunction(() => window.app.state.pieces.length === 32);
  assert.equal(await desktopPage.evaluate(() => {
    return window.app.state.pieces.every(piece => {
      const mesh = window.app.board3D.pieceMeshes.get(piece.id);
      return mesh?.userData.pieceType === piece.type &&
        mesh?.userData.pieceColor === piece.color;
    });
  }), true, 'Resetting after an imported position must rebuild reused piece IDs with the correct identity');
  await clickPieceAt(desktopPage, 7, 1);
  assert.ok(await desktopPage.evaluate(() => window.app.board3D.legalMoveDots.some(dot => dot.userData.row === 0 && dot.userData.col === 1)), 'Cannon capture target must be offered');
  await clickPieceAt(desktopPage, 0, 1);
  await desktopPage.waitForFunction(() => window.app.state.history.length === 1);
  assert.equal(await desktopPage.evaluate(() => window.app.state.pieces.find(piece => piece.row === 0 && piece.col === 1)?.color), 'red', 'Clicking the enemy piece centre must execute the cannon capture');

  // The next side must remain interactive after a capture.
  await clickPieceAt(desktopPage, 3, 0);
  await clickLegalTarget(desktopPage, 4, 0);
  await desktopPage.waitForFunction(() => window.app.state.history.length === 2);
  assert.equal(await desktopPage.evaluate(() => window.app.state.turn), 'red', 'Second move must complete instead of stalling');

  const lastMoveMarkerProof = await desktopPage.evaluate(() => {
    const markers = window.app.board3D.lastMoveMarkers;
    const destination = markers.find(marker => marker.userData.markerKind === 'last-destination');
    return {
      kinds: markers.map(marker => marker.userData.markerKind),
      destinationY: destination?.position.y || 0,
      destinationDepthTest: destination?.material?.depthTest,
    };
  });
  assert.deepEqual(lastMoveMarkerProof.kinds, ['last-origin', 'last-path', 'last-arrow', 'last-destination'], 'Last move annotation must distinguish origin, path, direction and destination');
  assert.ok(lastMoveMarkerProof.destinationY > 0.4, 'Destination halo must render above the moved piece');
  assert.equal(lastMoveMarkerProof.destinationDepthTest, false, 'Destination halo must not be hidden by the moved piece');

  const alignment = await desktopPage.evaluate(() => window.app.board3D.getBoardAlignmentMetrics());
  assert.ok(Math.abs(alignment.gridWorldWidth - alignment.pieceWorldWidth) < 0.01, 'Board columns and piece X coordinates must share one span');
  assert.ok(Math.abs(alignment.gridWorldHeight - alignment.pieceWorldHeight) < 0.01, 'Board rows and piece Z coordinates must share one span');
  await desktopPage.screenshot({ path: 'output/playwright/desktop-cannon-capture-fixed.png' });
  await desktopPage.click('#newGameBtn');

  // Test FEN Modal Open & Close
  await desktopPage.click('#fenModalBtn');
  await desktopPage.waitForSelector('#fenModal.active');
  const fenVal = await desktopPage.inputValue('#fenTextarea');
  assert.ok(fenVal.includes('rnbakabnr'), 'FEN textarea should contain initial FEN');
  await desktopPage.fill('#iccsTextarea', 'a3a4 a6a5');
  await desktopPage.click('#applyIccsBtn');
  await desktopPage.waitForFunction(() => window.app.state.history.length === 2);
  assert.equal(await desktopPage.evaluate(() => window.app.state.history.length), 2, 'ICCS import should restore two plies');
  await desktopPage.click('#fenModalBtn');
  const jsonPayload = await desktopPage.evaluate(() => JSON.stringify({
    schema: 'lu-xiangqi-game', version: 1, state: window.app.state
  }));
  const [download] = await Promise.all([
    desktopPage.waitForEvent('download'),
    desktopPage.click('#exportJsonBtn')
  ]);
  assert.ok(download.suggestedFilename().endsWith('.json'), 'JSON export should produce a downloadable file');
  await desktopPage.setInputFiles('#jsonFileInput', {
    name: 'lu-xiangqi-test.json',
    mimeType: 'application/json',
    buffer: Buffer.from(jsonPayload)
  });
  await desktopPage.waitForFunction(() => window.app.state.history.length === 2);
  await desktopPage.waitForTimeout(300);
  await desktopPage.reload({ waitUntil: 'networkidle' });
  await desktopPage.waitForFunction(() => window.app?.state?.history?.length === 2);
  assert.equal(await desktopPage.evaluate(() => window.app.state.history.length), 2, 'Autosave should restore move history after reload');

  // Test Settings Modal
  await desktopPage.click('#settingsBtn');
  await desktopPage.waitForSelector('#settingsModal.active');
  await desktopPage.selectOption('#themeSelect', 'epic');
  await desktopPage.locator('#roughnessRange').evaluate((el) => { el.value = '0.41'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await desktopPage.locator('#metalnessRange').evaluate((el) => { el.value = '0.52'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await desktopPage.locator('#clearcoatRange').evaluate((el) => { el.value = '0.76'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await desktopPage.locator('#pulseRange').evaluate((el) => { el.value = '0.68'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await desktopPage.screenshot({ path: 'output/playwright/desktop-material-controls.png' });
  await desktopPage.click('#saveSettingsBtn');
  await desktopPage.waitForTimeout(1800);
  const materialProof = await desktopPage.evaluate(() => {
    const mesh = Array.from(window.app.board3D.pieceMeshes.values())[0];
    const materials = [];
    mesh.traverse((node) => {
      if (!node.material) return;
      materials.push(...(Array.isArray(node.material) ? node.material : [node.material]));
    });
    const surface = materials.find((material) => !material.userData.isEnergy && 'roughness' in material);
    const energy = materials.find((material) => material.userData.isEnergy);
    return {
      theme: document.body.dataset.boardTheme,
      flatCamera: Math.abs(window.app.board3D.camera.position.z) < 4 && window.app.board3D.camera.position.y > 10,
      roughness: surface.roughness,
      metalness: surface.metalness,
      clearcoat: surface.clearcoat,
      pulse: energy?.userData.baseEmissive || 0,
      heroGeometry: !!mesh.userData.hero
    };
  });
  assert.equal(materialProof.theme, 'epic', 'Epic piece and board theme should switch live');
  assert.equal(materialProof.flatCamera, true, 'Board camera should be top-down and board should read as flat');
  assert.equal(materialProof.roughness, 0.41);
  assert.ok(materialProof.metalness >= 0.52, 'Hero material should respect the metalness control');
  assert.equal(materialProof.clearcoat, 0.76);
  assert.ok(materialProof.pulse > 0, 'Hero energy pulse must be active');
  assert.equal(materialProof.heroGeometry, true, 'Epic theme should use sculptural hero pieces');
  await desktopPage.click('#newGameBtn');
  await desktopPage.waitForTimeout(500);
  await desktopPage.screenshot({ path: 'output/playwright/desktop-1440-epic.png' });

  // Test AI vs AI Mode (EvE)
  await desktopPage.selectOption('#modeSelect', 'eve');
  await desktopPage.selectOption('#levelSelect', '5');
  await desktopPage.waitForFunction(() => {
    const r = window.app?.lastAIResult;
    return r?.engineName === 'Pikafish' && /^[a-i][0-9][a-i][0-9]$/.test(r.bestmove || '') && Number(r.info?.nodes) > 0;
  }, null, { timeout: 20000 });
  const pikafishProof = await desktopPage.evaluate(() => ({
    bestmove: window.app.lastAIResult.bestmove,
    engine: window.app.lastAIResult.engineName,
    depth: window.app.lastAIResult.info.depth,
    nodes: window.app.lastAIResult.info.nodes,
    nps: window.app.lastAIResult.info.nps,
    threads: window.app?.constructor ? document.querySelector('#statusText')?.textContent : ''
  }));
  console.log('Pikafish real search proof:', pikafishProof);
  assert.equal(pikafishProof.engine, 'Pikafish');
  assert.ok(pikafishProof.depth > 0 && pikafishProof.nodes > 0, 'Pikafish must emit real depth and nodes');
  await desktopPage.selectOption('#modeSelect', 'pve');

  // 3. Mobile Viewport (390 x 844)
  console.log('--- Testing Mobile Viewport (390x844) ---');
  const mobilePage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const mobileErrors = [];
  mobilePage.on('console', msg => {
    if (msg.type() === 'error') mobileErrors.push(msg.text());
  });

  await mobilePage.goto('http://127.0.0.1:8000/xiangqi.html', { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(1000);

  const mobileOverflow = await mobilePage.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });
  assert.equal(mobileOverflow, false, 'Mobile width should not overflow horizontally');
  const mobilePieceFraming = await mobilePage.evaluate(() => {
    const camera = window.app.board3D.camera;
    const xs = Array.from(window.app.board3D.pieceMeshes.values()).map(mesh => mesh.position.clone().project(camera).x);
    return { min: Math.min(...xs), max: Math.max(...xs) };
  });
  assert.ok(mobilePieceFraming.min > -0.9 && mobilePieceFraming.max < 0.9, 'Every mobile piece center must stay inside a 5% canvas safe margin');

  await mobilePage.screenshot({ path: 'output/playwright/mobile-390-final.png' });

  await mobilePage.click('#settingsBtn');
  await mobilePage.selectOption('#themeSelect', 'epic');
  await mobilePage.click('#saveSettingsBtn');
  await mobilePage.waitForTimeout(1600);
  const mobileEpicOverflow = await mobilePage.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  assert.equal(mobileEpicOverflow, false, 'Epic mobile theme should not overflow horizontally');
  await mobilePage.screenshot({ path: 'output/playwright/mobile-390-epic.png' });

  await browser.close();

  console.log('Desktop Errors:', desktopErrors);
  console.log('Mobile Errors:', mobileErrors);
  assert.equal(desktopErrors.length, 0, 'Desktop console should have 0 errors');
  assert.equal(mobileErrors.length, 0, 'Mobile console should have 0 errors');

  console.log('✅ ALL E2E VERIFICATION TESTS PASSED SUCCESSFULLY!');
}

runE2E().catch(err => {
  console.error('E2E Verification Failed:', err);
  process.exit(1);
});
