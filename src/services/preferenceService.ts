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
    storageService.setJson(LS_KEYS.dimensions, dimensionOrder);
    if (cachedPreferences) cachedPreferences.dimensionOrder = dimensionOrder;
    apiService.upsertPreference({ dimensionOrder }).catch(e =>
      console.warn('[DB] 保存维度排序失败:', e)
    );
  },

  getCurrentPath() {
    if (cachedPreferences) return cachedPreferences.currentPath;
    return storageService.getJson<string[]>(LS_KEYS.path, defaultPreferences.currentPath);
  },

  saveCurrentPath(currentPath: string[]) {
    storageService.setJson(LS_KEYS.path, currentPath);
    if (cachedPreferences) cachedPreferences.currentPath = currentPath;
    apiService.upsertPreference({ currentPath }).catch(e =>
      console.warn('[DB] 保存当前路径失败:', e)
    );
  },

  getSelectedFileId() {
    if (cachedPreferences) return cachedPreferences.selectedFileId;
    return storageService.getString(LS_KEYS.selectedFile, defaultPreferences.selectedFileId);
  },

  saveSelectedFileId(selectedFileId: string | null) {
    if (selectedFileId) {
      storageService.setString(LS_KEYS.selectedFile, selectedFileId);
    } else {
      storageService.remove(LS_KEYS.selectedFile);
    }
    if (cachedPreferences) cachedPreferences.selectedFileId = selectedFileId;
    apiService.upsertPreference({ selectedFileId }).catch(e =>
      console.warn('[DB] 保存选中文件失败:', e)
    );
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
