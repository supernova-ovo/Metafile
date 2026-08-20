import { useJobStore } from '../store/useJobStore';
import { useFileStore } from '../store/useFileStore';
import { UPLOAD_URL, apiClient, generateUUID, encodeData, getCurrentUserId } from './core/apiClient';
import { createMissingUploadUrlError, createUploadHttpError, getUploadErrorMessage } from './core/uploadErrors';
import * as apiService from './apiService';
import { fileService } from './fileService';

const SECTION_ID_FILES = '76c22773-66cb-a51c-359b-5a2872169266';

// ------------------------------------------------------------------
// Internal Helpers for the steps
// ------------------------------------------------------------------

async function uploadFileBinary(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('imgFile', file, file.name);

  const response = await fetch(UPLOAD_URL, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });

  if (!response.ok) {
    throw createUploadHttpError(response, file);
  }

  const result = await response.json();
  const url = result.url || result.data?.url || result.path || result.data?.path || '';
  
  if (!url) {
    throw createMissingUploadUrlError();
  }

  return url;
}

async function syncFileMetadata(job: ReturnType<typeof useJobStore.getState>['jobs'][string], url: string) {
  const file = job.meta;
  const attrText = Object.entries(file.attributes)
    .filter(([, values]) => values.length > 0)
    .map(([dim, values]) => `${dim}: ${values.join(', ')}`)
    .join('; ');
  const currentUserId = getCurrentUserId(undefined, 'uploader');
  const now = new Date().toISOString();

  const record = {
    sys_id: file.id || generateUUID(),
    WJMC: file.name,
    WJLX: file.type.toUpperCase(),
    WJDX: file.size,
    GXRQ: new Date(file.updatedAt).toISOString(),
    BZ: attrText || '前端上传',
    Url: url,
    XuHao: '1',
    sys_user: currentUserId,
    sys_date: now,
    sys_muser: currentUserId,
    sys_mdate: now,
    sys_valid: 1,
    sys_batchid: generateUUID(),
    sys_epsid: generateUUID(),
  };

  const encodedData = encodeData({ updated: [record] });

  const result = await apiClient({
    id: SECTION_ID_FILES,
    mode: 'update',
    _p_data: encodedData,
  });

  if (!(result.STATUS === 'Success' || result.STATUS === 'OK')) {
    throw new Error(result.MSG || result.MESSAGE || '后端同步失败');
  }
}

async function syncFileTags(job: ReturnType<typeof useJobStore.getState>['jobs'][string]) {
  // Sync attributes via existing apiService logic
  await apiService.syncAttributes(job.meta.id, job.meta.attributes);
}

// ------------------------------------------------------------------
// Job Runner
// ------------------------------------------------------------------

export const jobQueue = {
  startJob: async (jobId: string) => {
    const store = useJobStore.getState();
    const update = store.updateJob;
    const job = store.jobs[jobId];

    if (!job || (job.status !== 'pending' && job.status !== 'failed')) return;

    try {
      // Step 1: Uploading Binary
      if (!job.url) {
        update(jobId, { status: 'uploading', progress: 10, error: undefined });
        const url = await uploadFileBinary(job.file);
        update(jobId, { url, progress: 50 });
        useFileStore.getState().updateFileUrl(jobId, url);
      }

      // Step 2: Syncing Metadata & Tags
      update(jobId, { status: 'syncing', progress: 60 });
      const currentJob = useJobStore.getState().jobs[jobId]; // get latest url
      
      await syncFileMetadata(currentJob, currentJob.url!);
      update(jobId, { progress: 75 });

      const fileRecordReady = await apiService.waitForFileRecord(currentJob.meta.id);
      if (!fileRecordReady) {
        throw new Error('文件元数据已提交，但后端暂未确认主表记录，请稍后重试属性同步');
      }

      update(jobId, { progress: 80 });

      await syncFileTags(currentJob);
      fileService.clearPendingAttributeSync([jobId]);
      update(jobId, { status: 'success', progress: 100 });

    } catch (error: any) {
      console.error(`[JobQueue] Job ${jobId} failed:`, error);
      update(jobId, { status: 'failed', error: getUploadErrorMessage(error) });
      const failedJob = useJobStore.getState().jobs[jobId] || job;
      if (failedJob?.url) {
        fileService.markPendingAttributeSync([jobId]);
        fileService.notifySyncError({
          title: '上传属性同步失败',
          message: `${failedJob.meta.name} 已上传，但标签属性暂未保存到后端，请点击上传队列中的重试。`,
          fileId: jobId,
          error,
        });
      }
      
      // Remove from FileStore if it failed? 
      // Actually, it's better to keep it in the UI as a local file, but maybe mark it as failed visually later.
      // For now, if the user retries, it will re-run.
    }
  },

  retryJob: (jobId: string) => {
    jobQueue.startJob(jobId);
  },

  retryAllFailed: () => {
    const state = useJobStore.getState();
    Object.values(state.jobs).forEach(job => {
      if (job.status === 'failed') {
        jobQueue.startJob(job.id);
      }
    });
  }
};
