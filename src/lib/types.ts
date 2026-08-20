export interface FileItem {
  id: string;
  name: string;
  type: string;
  size: number; // in bytes
  updatedAt: string; // ISO string
  url?: string; // Optional download/preview URL
  attributes: Record<string, string[]>;
}

export interface VirtualFolder {
  id: string; // e.g. path '部门/财务部/密级/核心机密'
  name: string; // e.g. '核心机密'
  dimension: string; // e.g. '密级'
  path: string[];
  subFolders: Record<string, VirtualFolder>;
  files: FileItem[];
}

export interface ActiveFilter {
  dimension: string;
  value: string;
}

/** A reusable explorer destination saved by a user or by system settings. */
export interface SavedView {
  id: string;
  name: string;
  dimensionOrder: string[];
  currentPath: string[];
  sortOrder: number;
  enabled: boolean;
  updatedAt: string;
}
