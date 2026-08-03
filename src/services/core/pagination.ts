export interface PagedResult<T> {
  ROWS?: T[];
  TOTAL?: number | string;
}

/**
 * Collect a complete paged result set. The section handler does not guarantee
 * that newly-created records are included in its first page, so callers that
 * initialise an in-memory collection must not stop after page one.
 */
export async function queryAllPages<T>(
  queryPage: (page: number, pageSize: number) => Promise<PagedResult<T>>,
  pageSize: number
): Promise<{ ROWS: T[]; TOTAL: number }> {
  const rows: T[] = [];
  let page = 1;
  let total = 0;

  do {
    const result = await queryPage(page, pageSize);
    const pageRows = result.ROWS || [];
    rows.push(...pageRows);

    const reportedTotal = Number(result.TOTAL);
    total = Number.isFinite(reportedTotal) && reportedTotal >= 0
      ? reportedTotal
      : rows.length;

    if (pageRows.length === 0) break;
    page += 1;
  } while (rows.length < total);

  return { ROWS: rows, TOTAL: total };
}
