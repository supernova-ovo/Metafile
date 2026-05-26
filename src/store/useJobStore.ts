import { create } from 'zustand';
import type { FileItem } from '../lib/types';

export type JobStatus = 'pending' | 'uploading' | 'syncing' | 'success' | 'failed';

export interface UploadJob {
  id: string; // Job ID (can be the same as file ID)
  file: File;
  meta: FileItem;
  status: JobStatus;
  progress: number; // 0-100
  error?: string;
  url?: string;
}

interface JobStoreState {
  jobs: Record<string, UploadJob>;
  isQueueOpen: boolean;
  
  // Actions
  addJobs: (jobs: UploadJob[]) => void;
  updateJob: (jobId: string, updates: Partial<UploadJob>) => void;
  removeJob: (jobId: string) => void;
  clearCompleted: () => void;
  setQueueOpen: (isOpen: boolean) => void;
}

export const useJobStore = create<JobStoreState>((set) => ({
  jobs: {},
  isQueueOpen: false,

  addJobs: (newJobs) => set((state) => {
    const jobs = { ...state.jobs };
    newJobs.forEach(j => { jobs[j.id] = j; });
    return { jobs, isQueueOpen: true };
  }),

  updateJob: (jobId, updates) => set((state) => {
    const job = state.jobs[jobId];
    if (!job) return state;
    return {
      jobs: {
        ...state.jobs,
        [jobId]: { ...job, ...updates }
      }
    };
  }),

  removeJob: (jobId) => set((state) => {
    const jobs = { ...state.jobs };
    delete jobs[jobId];
    return { jobs };
  }),

  clearCompleted: () => set((state) => {
    const jobs = { ...state.jobs };
    Object.keys(jobs).forEach(key => {
      if (jobs[key].status === 'success') {
        delete jobs[key];
      }
    });
    return { jobs };
  }),

  setQueueOpen: (isOpen) => set({ isQueueOpen: isOpen }),
}));
