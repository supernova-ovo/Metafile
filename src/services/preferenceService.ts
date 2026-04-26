import type { AppPreferences } from '../types/api';
import { storageKeys, storageService } from './storageService';

export const defaultPreferences: AppPreferences = {
  dimensionOrder: ['项目'],
  currentPath: [],
  selectedFileId: null,
};

export const preferenceService = {
  getDimensionOrder() {
    return storageService.getJson<string[]>(storageKeys.dimensions, defaultPreferences.dimensionOrder);
  },

  saveDimensionOrder(dimensionOrder: string[]) {
    storageService.setJson(storageKeys.dimensions, dimensionOrder);
  },

  getCurrentPath() {
    return storageService.getJson<string[]>(storageKeys.path, defaultPreferences.currentPath);
  },

  saveCurrentPath(currentPath: string[]) {
    storageService.setJson(storageKeys.path, currentPath);
  },

  getSelectedFileId() {
    return storageService.getString(storageKeys.selectedFile, defaultPreferences.selectedFileId);
  },

  saveSelectedFileId(selectedFileId: string | null) {
    if (selectedFileId) {
      storageService.setString(storageKeys.selectedFile, selectedFileId);
      return;
    }

    storageService.remove(storageKeys.selectedFile);
  },

  resetPreferences() {
    storageService.remove(storageKeys.dimensions);
    storageService.remove(storageKeys.path);
    storageService.remove(storageKeys.selectedFile);

    return defaultPreferences;
  },
};
