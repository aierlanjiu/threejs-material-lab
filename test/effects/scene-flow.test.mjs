import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sceneFlowWeight } from '../../js/effects/effect-layer.js';

test('cool water and neutral clouds move while warm props and the center remain stable', () => {
  assert(sceneFlowWeight(.1, .8, 25, 170, 225) > .5);
  assert(sceneFlowWeight(.15, .1, 200, 210, 220) > .2);
  assert.equal(sceneFlowWeight(.1, .8, 210, 150, 60), 0, 'golden props stay static');
  assert.equal(sceneFlowWeight(.1, .8, 220, 193, 143), 0, 'warm paper stays static');
  assert.equal(sceneFlowWeight(.5, .48, 25, 170, 225), 0, 'center stays quiet even for cool colors');
});
