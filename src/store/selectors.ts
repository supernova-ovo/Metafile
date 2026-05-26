import type { FileStoreState } from './useFileStore';
import type { ActiveFilter, FileItem, VirtualFolder } from '../lib/types';
import { buildTree } from '../lib/tree';

// Basic selector to get all files as an array (for legacy compat)
export const selectAllFilesArray = (state: FileStoreState): FileItem[] => Object.values(state.files);

// Select files based on search and filters
export const selectFilteredFiles = (
  state: FileStoreState, 
  baseFiles: FileItem[],
  searchQuery: string, 
  activeFilters: ActiveFilter[], 
  quickFilter: string
): FileItem[] => {
  let result = baseFiles;

  // 1. Quick Filters
  if (quickFilter === 'recent') {
    const now = new Date();
    result = result.filter(f => {
      const fd = new Date(f.updatedAt);
      return (now.getTime() - fd.getTime()) < 7 * 24 * 60 * 60 * 1000;
    });
  } else if (quickFilter === 'uncategorized') {
    result = result.filter(f => Object.keys(f.attributes).every(k => k === '文件类型' || f.attributes[k].length === 0));
  } else if (quickFilter === 'large') {
    result = result.filter(f => f.size > 5 * 1024 * 1024);
  }

  // 2. Active Filters (using indexes)
  if (activeFilters.length > 0) {
    // Intersect the sets from the index
    let intersectedFileIds: Set<string> | null = null;
    
    for (const filter of activeFilters) {
      const tagKey = `${filter.dimension}::${filter.value}`;
      const tagSet = state.indexes.filesByTag[tagKey] || new Set<string>();
      
      if (intersectedFileIds === null) {
        intersectedFileIds = new Set(tagSet);
      } else {
        const newSet = new Set<string>();
        for (const id of intersectedFileIds) {
          if (tagSet.has(id)) newSet.add(id);
        }
        intersectedFileIds = newSet;
      }
    }
    
    if (intersectedFileIds !== null) {
      result = result.filter(f => intersectedFileIds!.has(f.id));
    }
  }

  // 3. Search Query (using pre-computed string index)
  const query = searchQuery.trim().toLowerCase();
  if (query) {
    result = result.filter(f => {
      const searchableText = state.indexes.searchIndex[f.id];
      return searchableText && searchableText.includes(query);
    });
  }

  return result;
};

// Select the virtual tree
export const selectVirtualTree = (state: FileStoreState, dimensionOrder: string[]): VirtualFolder => {
  // Use the existing buildTree logic for now, but pass the array.
  // In the future, this can be heavily optimized using indexes.
  return buildTree(Object.values(state.files), dimensionOrder);
};
