import type { AppPreferences } from '../types/api';
import { storageService } from './storageService';
import * as apiService from './apiService';

// LocalStorage 键名（降级用）
const LS_KEYS = {
  dimensions: 'metafile_dimensions',
  path: 'metafile_path',
  selectedFile: 'metafile_selectedFile',
  pendingPrefs: 'metafile_pending_preferences',
} as const;

export const defaultPreferences: AppPreferences = {
  dimensionOrder: ['项目'],
  currentPath: [],
  selectedFileId: null,
};

// 内存缓存，避免频繁查询数据库
let cachedPreferences: AppPreferences | null = null;
type PreferencePatch = {
  dimensionOrder?: string[];
  currentPath?: string[];
  selectedFileId?: string | null;
};

let pendingPrefs: PreferencePatch = {};
let pendingTimer: ReturnType<typeof setTimeout> | null = null;
let isFlushing = false;
const SAVE_DEBOUNCE_MS = 200;
const RETRY_SAVE_DELAY_MS = 3000;

function sameStringArray(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function isEmptyPreferencePatch(patch: PreferencePatch): boolean {
  return (
    patch.dimensionOrder === undefined &&
    patch.currentPath === undefined &&
    patch.selectedFileId === undefined
  );
}

function readPendingPreferencePatch(): PreferencePatch {
  return storageService.getJson<PreferencePatch>(LS_KEYS.pendingPrefs, {});
}

function savePendingPreferencePatch(patch: PreferencePatch) {
  if (isEmptyPreferencePatch(patch)) {
    storageService.remove(LS_KEYS.pendingPrefs);
    return;
  }
  storageService.setJson(LS_KEYS.pendingPrefs, patch);
}

function preferencePatchValueMatches<T extends keyof PreferencePatch>(
  current: PreferencePatch,
  payload: PreferencePatch,
  key: T
): boolean {
  if (current[key] === undefined || payload[key] === undefined) return false;
  if (key === 'selectedFileId') return current[key] === payload[key];
  return sameStringArray(current[key] as string[], payload[key] as string[]);
}

function clearFlushedPreferencePatch(payload: PreferencePatch) {
  const current = readPendingPreferencePatch();
  const next: PreferencePatch = { ...current };

  if (preferencePatchValueMatches(current, payload, 'dimensionOrder')) {
    delete next.dimensionOrder;
  }
  if (preferencePatchValueMatches(current, payload, 'currentPath')) {
    delete next.currentPath;
  }
  if (preferencePatchValueMatches(current, payload, 'selectedFileId')) {
    delete next.selectedFileId;
  }
  pendingPrefs = next;
  savePendingPreferencePatch(next);
}

function mergePreferencePatch(base: AppPreferences, patch: PreferencePatch): AppPreferences {
  return {
    dimensionOrder: patch.dimensionOrder ?? base.dimensionOrder,
    currentPath: patch.currentPath ?? base.currentPath,
    selectedFileId: patch.selectedFileId !== undefined ? patch.selectedFileId : base.selectedFileId,
  };
}

function persistPreferencesToLocal(preferences: AppPreferences) {
  storageService.setJson(LS_KEYS.dimensions, preferences.dimensionOrder);
  storageService.setJson(LS_KEYS.path, preferences.currentPath);
  if (preferences.selectedFileId) {
    storageService.setString(LS_KEYS.selectedFile, preferences.selectedFileId);
  } else {
    storageService.remove(LS_KEYS.selectedFile);
  }
}

function loadPreferencesFromLocal(): AppPreferences {
  return {
    dimensionOrder: storageService.getJson<string[]>(LS_KEYS.dimensions, defaultPreferences.dimensionOrder),
    currentPath: storageService.getJson<string[]>(LS_KEYS.path, defaultPreferences.currentPath),
    selectedFileId: storageService.getString(LS_KEYS.selectedFile, defaultPreferences.selectedFileId),
  };
}

function schedulePreferenceFlush(delayMs = SAVE_DEBOUNCE_MS) {
  if (pendingTimer) {
    clearTimeout(pendingTimer);
  }
  pendingTimer = setTimeout(async () => {
    pendingTimer = null;
    if (isFlushing) {
      schedulePreferenceFlush(delayMs);
      return;
    }

    const payload = readPendingPreferencePatch();
    if (isEmptyPreferencePatch(payload)) return;

    isFlushing = true;
    let retryDelayMs = SAVE_DEBOUNCE_MS;
    try {
      await apiService.upsertPreference(payload);
      clearFlushedPreferencePatch(payload);
    } catch (e) {
      pendingPrefs = { ...readPendingPreferencePatch(), ...payload };
      savePendingPreferencePatch(pendingPrefs);
      retryDelayMs = RETRY_SAVE_DELAY_MS;
      console.warn('[DB] 保存偏好失败，已保留待同步状态:', e);
    } finally {
      isFlushing = false;
      if (!isEmptyPreferencePatch(readPendingPreferencePatch())) {
        schedulePreferenceFlush(retryDelayMs);
      }
    }
  }, delayMs);
}

function enqueuePreferenceUpdate(patch: PreferencePatch) {
  pendingPrefs = { ...readPendingPreferencePatch(), ...pendingPrefs, ...patch };
  savePendingPreferencePatch(pendingPrefs);
  schedulePreferenceFlush();
}

/**
 * 从数据库加载用户偏好
 */
async function loadPreferencesFromDb(): Promise<AppPreferences | null> {
  try {
    const pref = await apiService.getPreference();
    if (!pref) return null;

    return {
      dimensionOrder: pref.WHPX ? JSON.parse(pref.WHPX) : defaultPreferences.dimensionOrder,
      currentPath: apiService.readPreferencePath(pref),
      selectedFileId: pref.XZWJID || null,
    };
  } catch {
    return null;
  }
}

export const preferenceService = {
  /**
   * 异步从数据库初始化偏好
   */
  async initFromDb(): Promise<AppPreferences> {
    pendingPrefs = readPendingPreferencePatch();
    const dbPref = await loadPreferencesFromDb();
    if (dbPref) {
      const mergedPreferences = mergePreferencePatch(dbPref, pendingPrefs);
      cachedPreferences = { ...mergedPreferences };
      persistPreferencesToLocal(mergedPreferences);
      if (!isEmptyPreferencePatch(pendingPrefs)) {
        schedulePreferenceFlush(0);
      }
      return mergedPreferences;
    }

    const fallbackPreferences = mergePreferencePatch(loadPreferencesFromLocal(), pendingPrefs);
    cachedPreferences = { ...fallbackPreferences };
    persistPreferencesToLocal(fallbackPreferences);
    savePendingPreferencePatch({
      ...pendingPrefs,
      dimensionOrder: fallbackPreferences.dimensionOrder,
      currentPath: fallbackPreferences.currentPath,
      selectedFileId: fallbackPreferences.selectedFileId,
    });
    schedulePreferenceFlush(0);
    return fallbackPreferences;
  },

  getDimensionOrder() {
    if (cachedPreferences) return cachedPreferences.dimensionOrder;
    return storageService.getJson<string[]>(LS_KEYS.dimensions, defaultPreferences.dimensionOrder);
  },

  saveDimensionOrder(dimensionOrder: string[]) {
    const prev = cachedPreferences?.dimensionOrder;
    if (prev && sameStringArray(prev, dimensionOrder)) return;
    storageService.setJson(LS_KEYS.dimensions, dimensionOrder);
    if (cachedPreferences) cachedPreferences.dimensionOrder = dimensionOrder;
    enqueuePreferenceUpdate({ dimensionOrder });
  },

  getCurrentPath() {
    if (cachedPreferences) return cachedPreferences.currentPath;
    return storageService.getJson<string[]>(LS_KEYS.path, defaultPreferences.currentPath);
  },

  saveCurrentPath(currentPath: string[]) {
    const prev = cachedPreferences?.currentPath;
    if (prev && sameStringArray(prev, currentPath)) return;
    storageService.setJson(LS_KEYS.path, currentPath);
    if (cachedPreferences) cachedPreferences.currentPath = currentPath;
    enqueuePreferenceUpdate({ currentPath });
  },

  getSelectedFileId() {
    if (cachedPreferences) return cachedPreferences.selectedFileId;
    return storageService.getString(LS_KEYS.selectedFile, defaultPreferences.selectedFileId);
  },

  saveSelectedFileId(selectedFileId: string | null) {
    const prev = cachedPreferences?.selectedFileId ?? null;
    if (prev === selectedFileId) return;
    if (selectedFileId) {
      storageService.setString(LS_KEYS.selectedFile, selectedFileId);
    } else {
      storageService.remove(LS_KEYS.selectedFile);
    }
    if (cachedPreferences) cachedPreferences.selectedFileId = selectedFileId;
    enqueuePreferenceUpdate({ selectedFileId });
  },

  async resetPreferences() {
    storageService.remove(LS_KEYS.dimensions);
    storageService.remove(LS_KEYS.path);
    storageService.remove(LS_KEYS.selectedFile);

    cachedPreferences = { ...defaultPreferences };
    persistPreferencesToLocal(defaultPreferences);
    enqueuePreferenceUpdate({
      dimensionOrder: defaultPreferences.dimensionOrder,
      currentPath: defaultPreferences.currentPath,
      selectedFileId: defaultPreferences.selectedFileId,
    });
    return defaultPreferences;
  },
};
