import { create } from 'zustand';
import type { FileItem } from '../lib/types';
import { fileService } from '../services/fileService';

export interface FileEntities {
  [id: string]: FileItem;
}

export interface Indexes {
  filesByTag: Record<string, Set<string>>; // "Dimension::TagValue" -> Set<FileId>
  filesByDimension: Record<string, Set<string>>; // "Dimension" -> Set<FileId>
  searchIndex: Record<string, string>; // FileId -> "name + tags"
}

export interface FileStoreState {
  files: FileEntities;
  indexes: Indexes;
  
  // Actions
  initFiles: (files: FileItem[]) => void;
  setFiles: (files: FileItem[], skipDbSync?: boolean) => void; // Used for replacing all files (e.g. from local storage/db)
  addFiles: (files: FileItem[]) => void;
  updateFileAttributes: (fileId: string, attributes: Record<string, string[]>) => void;
  deleteFile: (fileId: string) => void;
  resetFiles: () => void;
  
  // This allows us to trigger DB hydration
  hydrateFileAttributes: (fileId: string) => Promise<void>;
}

// Utility to build indexes from a list of files
function buildIndexes(fileEntities: FileEntities): Indexes {
  const filesByTag: Record<string, Set<string>> = {};
  const filesByDimension: Record<string, Set<string>> = {};
  const searchIndex: Record<string, string> = {};

  Object.values(fileEntities).forEach(f => {
    const searchParts = [f.name.toLowerCase()];
    Object.entries(f.attributes).forEach(([dim, tags]) => {
      if (!filesByDimension[dim]) filesByDimension[dim] = new Set();
      filesByDimension[dim].add(f.id);

      tags.forEach(tag => {
        const tagKey = `${dim}::${tag}`;
        if (!filesByTag[tagKey]) filesByTag[tagKey] = new Set();
        filesByTag[tagKey].add(f.id);
        searchParts.push(tag.toLowerCase());
      });
    });
    searchIndex[f.id] = searchParts.join(' ');
  });

  return { filesByTag, filesByDimension, searchIndex };
}

export const useFileStore = create<FileStoreState>((set, get) => {
  const initialFilesArray = fileService.getFiles();
  const initialFiles: FileEntities = {};
  initialFilesArray.forEach(f => initialFiles[f.id] = f);
  const initialIndexes = buildIndexes(initialFiles);

  return {
    files: initialFiles,
    indexes: initialIndexes,

    initFiles: (fileArray) => {
    const files: FileEntities = {};
    fileArray.forEach(f => files[f.id] = f);
    const indexes = buildIndexes(files);
    set({ files, indexes });
  },

  setFiles: (fileArray, skipDbSync = false) => {
    const files: FileEntities = {};
    fileArray.forEach(f => files[f.id] = f);
    const indexes = buildIndexes(files);
    set({ files, indexes });
    
    // Sync to DB/LocalStorage using the existing fileService
    fileService.saveFiles(fileArray, { skipDbSync });
  },

  addFiles: (newFiles) => {
    const state = get();
    const files = { ...state.files };
    newFiles.forEach(f => files[f.id] = f);
    const indexes = buildIndexes(files);
    set({ files, indexes });
    
    fileService.saveFiles(Object.values(files));
  },

  updateFileAttributes: (fileId, attributes) => {
    const state = get();
    const file = state.files[fileId];
    if (!file) return;
    
    // Call the service to do DB updates. It returns a new array of files.
    // However, since we are moving to normalized store, we can just update our store
    // and let fileService do the backend call.
    const updatedFilesArray = fileService.updateAttributes(Object.values(state.files), fileId, attributes);
    
    // Re-normalize (or we could just mutate our store and call apiService directly, but let's reuse fileService logic to avoid breaking backend sync)
    const files: FileEntities = {};
    updatedFilesArray.forEach(f => files[f.id] = f);
    const indexes = buildIndexes(files);
    
    set({ files, indexes });
    fileService.saveFiles(updatedFilesArray);
  },

  deleteFile: (fileId) => {
    const state = get();
    const files = { ...state.files };
    delete files[fileId];
    const indexes = buildIndexes(files);
    set({ files, indexes });
    
    // Note: The actual DB deletion is called from App.tsx via fileService.deleteFile(id).
    // We just update the local store here. We should probably move the fileService.deleteFile call here eventually.
    fileService.saveFiles(Object.values(files));
  },

  resetFiles: () => {
    const initialFiles = fileService.resetFiles();
    const files: FileEntities = {};
    initialFiles.forEach(f => files[f.id] = f);
    const indexes = buildIndexes(files);
    set({ files, indexes });
  },
  
  hydrateFileAttributes: async (fileId: string) => {
    const state = get();
    // fileService handles the "hydratedAttributeFileIds" set to avoid duplicate calls.
    const currentFilesArray = Object.values(state.files);
    const updatedFilesArray = await fileService.hydrateFileAttributes(currentFilesArray, fileId);
    
    // Only update state if something changed
    if (updatedFilesArray !== currentFilesArray) {
      const files: FileEntities = {};
      updatedFilesArray.forEach(f => files[f.id] = f);
      const indexes = buildIndexes(files);
      set({ files, indexes });
      fileService.saveFiles(updatedFilesArray, { skipDbSync: true }); // hydration shouldn't trigger saveToDb
    }
  }
  };
});
