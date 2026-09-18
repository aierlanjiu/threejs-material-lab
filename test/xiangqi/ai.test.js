import assert from 'node:assert/strict';
import { createInitialState } from '../../js/xiangqi/rules.js';
import { searchWukong } from '../../js/xiangqi/ai-wukong.js';

async function testWukong() {
  console.log('Testing Wukong AI...');
  const state = createInitialState();
  const res = await searchWukong('rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1', 1);
  assert.ok(res.bestmove, 'Should return bestmove string');
  assert.equal(typeof res.bestmove, 'string');
  assert.equal(res.bestmove.length, 4);
  assert.ok(res.move, 'Should parse move object');
  console.log('Wukong AI test passed, move:', res.bestmove);
}

testWukong().catch(err => {
  console.error('AI test failed:', err);
  process.exit(1);
});
