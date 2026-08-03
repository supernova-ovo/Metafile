import assert from 'node:assert/strict';
import test from 'node:test';

import { queryAllPages } from '../src/services/core/pagination.ts';

test('loads every page when the file count exceeds the initial page size', async () => {
  const calls = [];
  const records = Array.from({ length: 563 }, (_, index) => ({ sys_id: String(index + 1) }));

  const result = await queryAllPages(async (page, pageSize) => {
    calls.push({ page, pageSize });
    const offset = (page - 1) * pageSize;
    return {
      ROWS: records.slice(offset, offset + pageSize),
      TOTAL: records.length,
    };
  }, 500);

  assert.deepEqual(calls, [
    { page: 1, pageSize: 500 },
    { page: 2, pageSize: 500 },
  ]);
  assert.equal(result.TOTAL, 563);
  assert.equal(result.ROWS.length, 563);
  assert.equal(result.ROWS.at(-1)?.sys_id, '563');
});
