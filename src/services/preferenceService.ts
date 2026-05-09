import type { AppPreferences } from '../types/api';
import { storageService } from './storageService';
import * as apiService from './apiService';

// LocalStorage 键名（降级用）
const LS_KEYS = {
  dimensions: 'metafile_dimensions',
  path: 'metafile_path',
  selectedFile: 'metafile_selectedFile',
} as const;

export const defaultPreferences: AppPreferences = {
  dimensionOrder: ['项目'],
  currentPath: [],
  selectedFileId: null,
};

// 内存缓存，避免频繁查询数据库
let cachedPreferences: AppPreferences | null = null;
let pendingPrefs: { dimensionOrder?: string[]; currentPath?: string[]; selectedFileId?: string | null } = {};
let pendingTimer: ReturnType<typeof setTimeout> | null = null;
let isFlushing = false;
const SAVE_DEBOUNCE_MS = 200;

function sameStringArray(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function enqueuePreferenceUpdate(patch: { dimensionOrder?: string[]; currentPath?: string[]; selectedFileId?: string | null }) {
  pendingPrefs = { ...pendingPrefs, ...patch };
  if (pendingTimer) {
    clearTimeout(pendingTimer);
  }
  pendingTimer = setTimeout(async () => {
    pendingTimer = null;
    if (isFlushing) return;
    const payload = pendingPrefs;
    pendingPrefs = {};
    if (
      payload.dimensionOrder === undefined &&
      payload.currentPath === undefined &&
      payload.selectedFileId === undefined
    ) {
      return;
    }
    isFlushing = true;
    try {
      await apiService.upsertPreference(payload);
    } catch (e) {
      console.warn('[DB] 保存偏好失败:', e);
    } finally {
      isFlushing = false;
      if (
        pendingPrefs.dimensionOrder !== undefined ||
        pendingPrefs.currentPath !== undefined ||
        pendingPrefs.selectedFileId !== undefined
      ) {
        enqueuePreferenceUpdate({});
      }
    }
  }, SAVE_DEBOUNCE_MS);
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
      currentPath: pref.DQDL ? JSON.parse(pref.DQDL) : defaultPreferences.currentPath,
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
    const dbPref = await loadPreferencesFromDb();
    if (dbPref) {
      cachedPreferences = { ...dbPref };
      // 同步到 LocalStorage 作为缓存
      storageService.setJson(LS_KEYS.dimensions, dbPref.dimensionOrder);
      storageService.setJson(LS_KEYS.path, dbPref.currentPath);
      if (dbPref.selectedFileId) {
        storageService.setString(LS_KEYS.selectedFile, dbPref.selectedFileId);
      }
      return dbPref;
    }

    // 数据库无偏好 → 写入默认值
    const defaults = { ...defaultPreferences };
    cachedPreferences = defaults;
    await apiService.upsertPreference({
      dimensionOrder: defaults.dimensionOrder,
      currentPath: defaults.currentPath,
      selectedFileId: defaults.selectedFileId,
    });
    return defaults;
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

    // 重置数据库
    try {
      await apiService.upsertPreference({
        dimensionOrder: defaultPreferences.dimensionOrder,
        currentPath: defaultPreferences.currentPath,
        selectedFileId: defaultPreferences.selectedFileId,
      });
    } catch {}

    cachedPreferences = { ...defaultPreferences };
    return defaultPreferences;
  },
};
