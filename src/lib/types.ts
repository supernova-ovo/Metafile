export interface FileItem {
  id: string;
  name: string;
  type: string;
  size: number; // in bytes
  updatedAt: string; // ISO string
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
