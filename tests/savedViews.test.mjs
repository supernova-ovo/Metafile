import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeSavedViews, parseSavedViews, reorderSavedViews } from '../src/lib/savedViews.ts';

test('normalizes saved views, ignores malformed entries, and keeps configured order', () => {
  const views = normalizeSavedViews([
    { id: 'later', name: 'Later', dimensionOrder: ['年度'], currentPath: ['2026'], sortOrder: 4, enabled: true },
    { id: 'first', name: ' First ', dimensionOrder: ['项目', 3], currentPath: ['商河', ''], sortOrder: 1 },
    { id: 'first', name: 'duplicate id', dimensionOrder: [], currentPath: [] },
    { id: '', name: 'missing id', dimensionOrder: [], currentPath: [] },
  ]);

  assert.deepEqual(views.map((view) => view.id), ['first', 'later']);
  assert.deepEqual(views[0].dimensionOrder, ['项目']);
  assert.deepEqual(views[0].currentPath, ['商河']);
  assert.equal(views[0].enabled, true);
});

test('parses invalid storage safely and writes sequential sort positions', () => {
  assert.deepEqual(parseSavedViews('{not-json'), []);

  const views = reorderSavedViews([
    { id: 'b', name: 'B', dimensionOrder: [], currentPath: [], sortOrder: 8, enabled: true, updatedAt: '' },
    { id: 'a', name: 'A', dimensionOrder: [], currentPath: [], sortOrder: 3, enabled: true, updatedAt: '' },
  ]);

  assert.deepEqual(views.map((view) => view.sortOrder), [0, 1]);
});
