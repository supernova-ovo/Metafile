import type { FileItem } from '../lib/types';

export interface ApiFileRecord extends FileItem {}

export interface AppPreferences {
  dimensionOrder: string[];
  currentPath: string[];
  selectedFileId: string | null;
}
