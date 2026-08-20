import type { SavedView } from './types';

export const MAX_SAVED_VIEW_NAME_LENGTH = 50;

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * Keeps saved-view data resilient to older or manually edited JSON records.
 * Invalid rows are ignored instead of preventing the explorer from loading.
 */
export function normalizeSavedViews(value: unknown): SavedView[] {
  if (!Array.isArray(value)) return [];

  const seenIds = new Set<string>();
  const views: SavedView[] = [];

  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const record = raw as Partial<SavedView>;
    const id = typeof record.id === 'string' ? record.id.trim() : '';
    const name = typeof record.name === 'string' ? record.name.trim().slice(0, MAX_SAVED_VIEW_NAME_LENGTH) : '';
    if (!id || !name || seenIds.has(id)) continue;

    seenIds.add(id);
    views.push({
      id,
      name,
      dimensionOrder: stringArray(record.dimensionOrder),
      currentPath: stringArray(record.currentPath),
      sortOrder: Number.isFinite(Number(record.sortOrder)) ? Number(record.sortOrder) : views.length,
      enabled: record.enabled !== false,
      updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : '',
    });
  }

  return views.sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name, 'zh-CN'));
}

export function parseSavedViews(raw: string | undefined): SavedView[] {
  if (!raw) return [];
  try {
    return normalizeSavedViews(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function reorderSavedViews(views: SavedView[]): SavedView[] {
  return views.map((view, index) => ({ ...view, sortOrder: index }));
}
