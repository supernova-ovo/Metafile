import { mockFiles } from '../lib/mock-data';
import type { FileItem } from '../lib/types';
import type { ApiFileRecord } from '../types/api';
import { storageKeys, storageService } from './storageService';

const FILE_TYPE_DIMENSION = '文件类型';

const cloneAttributes = (attributes: Record<string, string[]>) =>
  Object.fromEntries(Object.entries(attributes).map(([key, values]) => [key, [...values]]));

export const normalizeFileRecord = (file: ApiFileRecord): FileItem => ({
  ...file,
  attributes: {
    ...cloneAttributes(file.attributes),
    [FILE_TYPE_DIMENSION]: [file.type.toUpperCase()],
  },
});

export const normalizeFiles = (files: ApiFileRecord[]): FileItem[] => files.map(normalizeFileRecord);

export const fileService = {
  getFiles() {
    const persistedFiles = storageService.getJson<ApiFileRecord[] | null>(storageKeys.files, null);
    return normalizeFiles(persistedFiles ?? mockFiles);
  },

  saveFiles(files: FileItem[]) {
    storageService.setJson(storageKeys.files, files);
  },

  updateAttributes(files: FileItem[], fileId: string, newAttributes: Record<string, string[]>) {
    return files.map((file) => {
      if (file.id !== fileId) return file;

      return normalizeFileRecord({
        ...file,
        attributes: newAttributes,
      });
    });
  },

  createUploadDrafts(browserFiles: File[], currentPath: string[], dimensionOrder: string[]) {
    const baseAttributes: Record<string, string[]> = {};

    currentPath.forEach((segment, index) => {
      const dimension = dimensionOrder[index];
      if (dimension && dimension !== FILE_TYPE_DIMENSION) {
        baseAttributes[dimension] = [segment];
      }
    });

    const now = Date.now();

    return browserFiles.map((file, index) => {
      const extension = file.name.split('.').pop() || 'unknown';

      return normalizeFileRecord({
        id: `upload-${now}-${index}`,
        name: file.name,
        type: extension,
        size: file.size,
        updatedAt: new Date(file.lastModified).toISOString(),
        attributes: cloneAttributes(baseAttributes),
      });
    });
  },

  resetFiles() {
    storageService.remove(storageKeys.files);
    return normalizeFiles(mockFiles);
  },
};
