import { mockFiles } from '../lib/mock-data';
import type { FileItem } from '../lib/types';
import type { FileRow } from './apiService';
import { storageService } from './storageService';
import * as apiService from './apiService';

const FILE_TYPE_DIMENSION = '文件类型';
const LOCALSTORAGE_KEY = 'metafile_files';
const SAVE_DEBOUNCE_MS = 500;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

let pendingSaveTimer: ReturnType<typeof setTimeout> | null = null;
let latestPendingFiles: FileItem[] = [];
let isSavingToDb = false;
const lastSyncedFingerprints = new Map<string, string>();
const hydratedAttributeFileIds = new Set<string>();

const cloneAttributes = (attributes: Record<string, string[]>) =>
  Object.fromEntries(Object.entries(attributes).map(([key, values]) => [key, [...values]]));

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

function normalizeFileIds(files: FileItem[]): FileItem[] {
  const idMap = new Map<string, string>();
  return files.map((file) => {
    if (isUuid(file.id)) return { ...file, attributes: cloneAttributes(file.attributes) };
    if (!idMap.has(file.id)) {
      idMap.set(file.id, apiService.generateUUID());
    }
    return {
      ...file,
      id: idMap.get(file.id)!,
      attributes: cloneAttributes(file.attributes),
    };
  });
}

const cloneMockFiles = (): FileItem[] => normalizeFileIds(mockFiles as FileItem[]);

function stableAttributesString(attributes: Record<string, string[]>): string {
  const sortedKeys = Object.keys(attributes).sort();
  const normalized = sortedKeys.map((key) => [key, [...(attributes[key] || [])].sort()]);
  return JSON.stringify(normalized);
}

function getFileFingerprint(file: FileItem): string {
  return JSON.stringify({
    id: file.id,
    name: file.name,
    type: file.type,
    size: file.size,
    updatedAt: file.updatedAt,
    url: file.url,
    attributes: stableAttributesString(file.attributes),
  });
}

function markFilesAsSynced(files: FileItem[]) {
  lastSyncedFingerprints.clear();
  hydratedAttributeFileIds.clear();
  for (const file of files) {
    lastSyncedFingerprints.set(file.id, getFileFingerprint(file));
  }
}

/**
 * 将数据库行记录转换为前端 FileItem
 */
function dbRowToFileItem(row: FileRow): FileItem {
  return {
    id: row.sys_id,
    name: row.WJMC || '',
    type: (row.WJLX || '').toLowerCase(),
    size: row.WJDX || 0,
    updatedAt: row.GXRQ || new Date().toISOString(),
    url: row.Url,
    attributes: { [FILE_TYPE_DIMENSION]: [(row.WJLX || '').toUpperCase()] },
  };
}

function rowsToFileItems(rows: FileRow[]): FileItem[] {
  return rows.map(dbRowToFileItem);
}

export const fileService = {
  /**
   * 同步从 LocalStorage 加载（用于初始渲染）
   */
  getFiles(): FileItem[] {
    const stored = storageService.getJson<FileItem[] | null>(LOCALSTORAGE_KEY, null);
    if (!stored) return cloneMockFiles();
    const normalized = normalizeFileIds(stored);
    // 兼容历史缓存中的非 UUID sys_id
    storageService.setJson(LOCALSTORAGE_KEY, normalized);
    return normalized;
  },

  /**
   * 异步从数据库初始化数据
   * 如果数据库为空则自动写入种子数据（mockFiles）
   */
  async initFromDb(): Promise<FileItem[]> {
    try {
      const { ROWS, TOTAL } = await apiService.queryFiles(1, 500);
      // console.log(`[DB] queryFiles 返回: TOTAL=${TOTAL}, ROWS=${ROWS.length}`);

      if (TOTAL === 0) {
        // 避免初始化阶段触发大量 update/query 风暴：不在前端自动写后端种子数据。
        if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
          // console.log('[DB] 开发环境且数据库为空，加载前端测试数据（仅留存在本地，不写后端）。');
          const files = cloneMockFiles();
          storageService.setJson(LOCALSTORAGE_KEY, files);
          markFilesAsSynced(files);
          return files;
        } else {
          // console.log('[DB] 生产环境且数据库为空，初始化为空列表。');
          const files: FileItem[] = [];
          storageService.setJson(LOCALSTORAGE_KEY, files);
          markFilesAsSynced(files);
          return files;
        }
      }

      // 初始化走批量属性回填：保证首屏文件都带标签关系，避免逐文件 N+1。
      const files = rowsToFileItems(ROWS);
      try {
        const allAttrs = await apiService.loadAllFileAttributes();
        for (const f of files) {
          const attrs = allAttrs[f.id];
          if (attrs) {
            f.attributes = {
              ...attrs,
              [FILE_TYPE_DIMENSION]: [(f.type || '').toUpperCase()],
            };
            hydratedAttributeFileIds.add(f.id);
          }
        }
      } catch (e) {
        console.warn('[DB] 批量回填文件属性失败，回退懒加载模式:', e);
      }
      storageService.setJson(LOCALSTORAGE_KEY, files);
      // 关键：将初始化结果标记为同步基线，避免首次后续保存误删后端已有标签关联。
      markFilesAsSynced(files);
      if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
        apiService.auditFileTagRelations()
          .then(() => { /* console.log('[DB_AUDIT] 文件-标签关联健康度') */ })
          .catch((e) => console.warn('[DB_AUDIT] 关联审计失败', e));
      }
      return files;
    } catch (error) {
      console.warn('[DB] 从数据库加载失败，保持 LocalStorage 数据:', error);
      const files = this.getFiles();
      markFilesAsSynced(files);
      return files;
    }
  },

  /**
   * 将 mock 种子数据写入数据库
   */
  async seedMockData(): Promise<void> {
    const now = new Date().toISOString();

    const fileRows = mockFiles.map((f, i) => ({
      WJMC: f.name,
      WJLX: f.type.toUpperCase(),
      WJDX: f.size,
      GXRQ: f.updatedAt,
      BZ: `种子数据 - ${f.attributes['文件类型']?.join(', ') || ''}`,
      XuHao: String(i + 1),
      sys_id: f.id,
      sys_user: 'seed',
      sys_date: now,
      sys_muser: 'seed',
      sys_mdate: now,
      sys_valid: 1,
      sys_batchid: apiService.generateUUID(),
      sys_epsid: apiService.generateUUID(),
    }));

    await apiService.insertFileRecords(fileRows);

    for (const file of mockFiles) {
      await apiService.syncAttributes(file.id, file.attributes);
    }

    const availableDimensions = ['项目', '档案类别', '档案分类', '状态', '年份', '文件类型', '密级', '部门'];
    for (const dim of availableDimensions) {
      await apiService.ensureDimension(dim);
    }

    // console.log('[DB] 种子数据写入完成（10 个文件）');
  },

  /**
   * 保存文件（同步写入 LocalStorage + 异步写入数据库）
   */
  saveFiles(files: FileItem[], options?: { skipDbSync?: boolean }) {
    storageService.setJson(LOCALSTORAGE_KEY, files);
    if (options?.skipDbSync) return;
    latestPendingFiles = files;
    if (pendingSaveTimer) {
      clearTimeout(pendingSaveTimer);
    }
    pendingSaveTimer = setTimeout(() => {
      pendingSaveTimer = null;
      void this.saveToDbAsync(latestPendingFiles).catch(e => console.warn('[DB] 异步写入失败:', e));
    }, SAVE_DEBOUNCE_MS);
  },

  /**
   * 异步写入数据库
   */
  async saveToDbAsync(files: FileItem[]): Promise<void> {
    if (isSavingToDb) {
      latestPendingFiles = files;
      return;
    }
    isSavingToDb = true;

    const changedFiles = files.filter((file) => {
      const fingerprint = getFileFingerprint(file);
      return lastSyncedFingerprints.get(file.id) !== fingerprint;
    });

    if (changedFiles.length === 0) {
      isSavingToDb = false;
      return;
    }

    for (const file of changedFiles) {
      try {
        const now = new Date().toISOString();
        const updated = await apiService.updateFileRecord(file.id, {
          WJMC: file.name,
          WJLX: file.type.toUpperCase(),
          WJDX: file.size,
          GXRQ: file.updatedAt,
          BZ: '前端上传',
          XuHao: '1',
          sys_user: 'uploader',
          sys_date: now,
          sys_muser: 'uploader',
          sys_mdate: now,
          sys_valid: 1,
          sys_batchid: apiService.generateUUID(),
          sys_epsid: apiService.generateUUID(),
        });

        if (!updated) {
          await apiService.insertFileRecord({
            WJMC: file.name,
            WJLX: file.type.toUpperCase(),
            WJDX: file.size,
            GXRQ: file.updatedAt,
            BZ: '前端上传',
            XuHao: '1',
            sys_id: file.id,
            sys_user: 'uploader',
            sys_date: now,
            sys_muser: 'uploader',
            sys_mdate: now,
            sys_valid: 1,
            sys_batchid: apiService.generateUUID(),
            sys_epsid: apiService.generateUUID(),
          });
        }

        await apiService.syncAttributes(file.id, file.attributes);
        lastSyncedFingerprints.set(file.id, getFileFingerprint(file));
      } catch (err) {
        console.warn('[DB] 文件写入失败:', file.name, err);
      }
    }

    isSavingToDb = false;
    if (latestPendingFiles !== files) {
      void this.saveToDbAsync(latestPendingFiles).catch(e => console.warn('[DB] 异步写入失败:', e));
    }
  },

  /**
   * 更新文件属性（同步本地 + 异步同步数据库）
   */
  updateAttributes(files: FileItem[], fileId: string, newAttributes: Record<string, string[]>) {
    const updatedFiles = files.map((file) => {
      if (file.id !== fileId) return file;
      return { ...file, attributes: cloneAttributes(newAttributes) };
    });

    hydratedAttributeFileIds.add(fileId);

    const targetFile = updatedFiles.find(f => f.id === fileId);
    if (targetFile) {
      lastSyncedFingerprints.set(fileId, getFileFingerprint(targetFile));
    }

    apiService.syncAttributes(fileId, newAttributes)
      .catch(e => console.warn('[DB]', e));

    return updatedFiles;
  },

  async syncUploadedAttributes(files: FileItem[]): Promise<void> {
    for (const file of files) {
      try {
        await apiService.syncAttributes(file.id, file.attributes);
      } catch (e) {
        console.warn('[DB] 上传后属性同步失败:', file.name, e);
      }
    }
  },

  async hydrateFileAttributes(files: FileItem[], fileId: string): Promise<FileItem[]> {
    if (hydratedAttributeFileIds.has(fileId)) return files;
    const target = files.find((f) => f.id === fileId);
    if (!target) return files;

    try {
      const attrs = await apiService.loadFileAttributes(fileId);
      const merged = {
        ...attrs,
        [FILE_TYPE_DIMENSION]: [(target.type || '').toUpperCase()],
      };
      const next = files.map((f) => (f.id === fileId ? { ...f, attributes: cloneAttributes(merged) } : f));
      hydratedAttributeFileIds.add(fileId);
      return next;
    } catch (e) {
      console.warn('[DB] 懒加载文件属性失败:', fileId, e);
      return files;
    }
  },

  async deleteFile(fileId: string): Promise<boolean> {
    const deleted = await apiService.deleteFileWithRelations(fileId);
    if (!deleted) {
      throw new Error('删除后端文件记录失败');
    }
    return true;
  },

  /**
   * 创建上传草稿（纯前端）
   */
  createUploadDrafts(browserFiles: File[], currentPath: string[], dimensionOrder: string[]) {
    const baseAttributes: Record<string, string[]> = {};
    currentPath.forEach((segment, index) => {
      const dimension = dimensionOrder[index];
      if (dimension && dimension !== FILE_TYPE_DIMENSION) {
        baseAttributes[dimension] = [segment];
      }
    });

    return browserFiles.map((file) => {
      const extension = file.name.split('.').pop() || 'unknown';
      return {
        id: apiService.generateUUID(),
        name: file.name,
        type: extension,
        size: file.size,
        updatedAt: new Date(file.lastModified).toISOString(),
        attributes: cloneAttributes(baseAttributes),
      };
    });
  },

  /**
   * 重置（清空缓存，返回 mock 数据）
   */
  resetFiles() {
    storageService.remove(LOCALSTORAGE_KEY);
    return cloneMockFiles();
  },
};
