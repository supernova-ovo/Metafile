import type { FileItem, VirtualFolder } from './types';

export function buildTree(files: FileItem[], dimensionOrder: string[]): VirtualFolder {
  const root: VirtualFolder = {
    id: 'root',
    name: '全部文件',
    dimension: 'root',
    path: [],
    subFolders: {},
    files: [],
  };

  for (const file of files) {
    const hasAnyTag = Object.keys(file.attributes).some(key => file.attributes[key] && file.attributes[key].length > 0);
    
    if (!hasAnyTag) {
      if (!root.subFolders['待处理 (Inbox)']) {
        root.subFolders['待处理 (Inbox)'] = {
          id: 'inbox',
          name: '待处理 (Inbox)',
          dimension: '系统',
          path: ['待处理 (Inbox)'],
          subFolders: {},
          files: [],
        };
      }
      root.subFolders['待处理 (Inbox)'].files.push(file);
      continue;
    }

    insertFile(root, file, dimensionOrder, 0);
  }

  return root;
}

function insertFile(node: VirtualFolder, file: FileItem, dimensionOrder: string[], dimIndex: number) {
  if (dimIndex >= dimensionOrder.length) {
    // Reached the end of dimensions, add file to this folder's file list
    if (!node.files.some(f => f.id === file.id)) {
      node.files.push(file);
    }
    return;
  }

  const currentDim = dimensionOrder[dimIndex];
  const values = file.attributes[currentDim];

  const folderNames = (values && values.length > 0) ? values : ['未分类 (Unassigned)'];

  for (const folderName of folderNames) {
    if (!node.subFolders[folderName]) {
      const newPath = [...node.path, folderName];
      node.subFolders[folderName] = {
        id: newPath.join('/'),
        name: folderName,
        dimension: currentDim,
        path: newPath,
        subFolders: {},
        files: [],
      };
    }
    insertFile(node.subFolders[folderName], file, dimensionOrder, dimIndex + 1);
  }
}

// Helper to get all files under a folder recursively, removing duplicates
export function getAllFilesInFolder(folder: VirtualFolder): FileItem[] {
  const fileMap = new Map<string, FileItem>();
  
  function traverse(node: VirtualFolder) {
    for (const file of node.files) {
      if (!fileMap.has(file.id)) {
        fileMap.set(file.id, file);
      }
    }
    for (const sub of Object.values(node.subFolders)) {
      traverse(sub);
    }
  }
  
  traverse(folder);
  return Array.from(fileMap.values());
}

// Find all virtual paths for a specific file given current dimension order
export function findPathsForFile(files: FileItem[], dimensionOrder: string[], fileId: string): string[][] {
  const root = buildTree(files, dimensionOrder);
  const paths: string[][] = [];

  function traverse(node: VirtualFolder, currentPath: string[]) {
    // If we are at a leaf node and the file is here
    if (node.files.some(f => f.id === fileId)) {
      paths.push(currentPath);
    }
    for (const subFolder of Object.values(node.subFolders)) {
      traverse(subFolder, [...currentPath, subFolder.name]);
    }
  }

  for (const sub of Object.values(root.subFolders)) {
    traverse(sub, [sub.name]);
  }

  return paths;
}
