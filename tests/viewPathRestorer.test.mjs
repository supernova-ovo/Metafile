import assert from 'node:assert/strict';
import test from 'node:test';

import { createViewPathRestorer } from '../src/lib/viewPathRestorer.ts';

test('keeps a saved leaf path while the first post-order-change render still has an old path snapshot', () => {
  const restorer = createViewPathRestorer();
  restorer.schedule(['商河项目', '董事会', '2026']);

  assert.deepEqual(restorer.consumeDimensionOrderChange(), ['商河项目', '董事会', '2026']);
  assert.equal(restorer.shouldSanitizePath(), false);
  assert.equal(restorer.shouldSanitizePath(), true);
});

test('uses the normal root reset when no preset path was scheduled', () => {
  const restorer = createViewPathRestorer();

  assert.deepEqual(restorer.consumeDimensionOrderChange(), []);
  assert.equal(restorer.shouldSanitizePath(), true);
});
