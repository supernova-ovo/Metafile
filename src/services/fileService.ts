import { mockFiles } from '../lib/mock-data';
import type { FileItem } from '../lib/types';
import type { FileRow } from './apiService';
import { storageService } from './storageService';
import * as apiService from './apiService';

const FILE_TYPE_DIMENSION = '文件类型';
const LOCALSTORAGE_KEY = 'metafile_files';

const cloneAttributes = (attributes: Record<string, string[]>) =>
  Object.fromEntries(Object.entries(attributes).map(([key, values]) => [key, [...values]]));

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
    attributes: { [FILE_TYPE_DIMENSION]: [(row.WJLX || '').toUpperCase()] },
  };
}

/**
 * 将数据库行记录列表转换为前端 FileItem（带完整 attributes）
 */
async function enrichRowsWithAttributes(rows: FileRow[]): Promise<FileItem[]> {
  return Promise.all(
    rows.map(async (row) => {
      const file = dbRowToFileItem(row);
      try {
        const attrs = await apiService.loadFileAttributes(row.sys_id);
        file.attributes = { ...attrs, [FILE_TYPE_DIMENSION]: [(row.WJLX || '').toUpperCase()] };
      } catch {
        // 加载属性失败，保留默认属性
      }
      return file;
    })
  );
}

export const fileService = {
  /**
   * 同步从 LocalStorage 加载（用于初始渲染）
   */
  getFiles(): FileItem[] {
    const stored = storageService.getJson<FileItem[] | null>(LOCALSTORAGE_KEY, null);
    return stored ?? mockFiles.map(f => ({ ...f, attributes: cloneAttributes(f.attributes) }));
  },

  /**
   * 异步从数据库初始化数据
   * 如果数据库为空则自动写入种子数据（mockFiles）
   */
  async initFromDb(): Promise<FileItem[]> {
    try {
      // 尝试连接并查询
      const { ROWS, TOTAL } = await apiService.queryFiles(1, 500);

      if (TOTAL === 0) {
        // 数据库为空 → 种子数据
        console.log('[DB] 数据库为空，写入种子数据...');
        await this.seedMockData();
        // 重新查询
        const { ROWS: newRows } = await apiService.queryFiles(1, 500);
        const files = await enrichRowsWithAttributes(newRows);
        storageService.setJson(LOCALSTORAGE_KEY, files);
        return files;
      }

      // 有数据 → 直接加载
      const files = await enrichRowsWithAttributes(ROWS);
      storageService.setJson(LOCALSTORAGE_KEY, files);
      return files;
    } catch (error) {
      console.warn('[DB] 从数据库加载失败，保持 LocalStorage 数据:', error);
      return this.getFiles();
    }
  },

  /**
   * 将 mock 种子数据写入数据库
   */
  async seedMockData(): Promise<void> {
    // 1. 插入所有文件到 D_WJGL_WJ
    const fileRows = mockFiles.map((f, i) => ({
      WJMC: f.name,
      WJLX: f.type.toUpperCase(),
      WJDX: f.size,
      GXRQ: f.updatedAt,
      BZ: `种子数据 - ${f.attributes['文件类型']?.join(', ') || ''}`,
      XuHao: String(i + 1),
      sys_id: f.id,
      sys_user: 'seed',
      sys_muser: 'seed',
      sys_valid: 1,
      sys_batchid: apiService.generateUUID(),
      sys_epsid: apiService.generateUUID(),
    }));

    await apiService.insertFileRecords(fileRows);

    // 2. 同步每个文件的 attributes → D_WJGL_WH / D_WJGL_BQ / D_WJGL_WJBQ
    for (const file of mockFiles) {
      await apiService.syncAttributes(file.id, file.attributes);
    }

    // 3. 确保所有维度在 D_WJGL_WH 中存在
    const availableDimensions = ['项目', '档案类别', '档案分类', '状态', '年份', '文件类型', '密级', '部门'];
    for (const dim of availableDimensions) {
      await apiService.ensureDimension(dim);
    }

    console.log('[DB] 种子数据写入完成（10 个文件）');
  },

  /**
   * 保存文件（同步写入 LocalStorage + 异步写入数据库）
   */
  saveFiles(files: FileItem[]) {
    storageService.setJson(LOCALSTORAGE_KEY, files);

    // 异步批量写入数据库
    this.saveToDbAsync(files).catch(e => console.warn('[DB] 异步写入失败:', e));
  },

  /**
   * 异步写入数据库
   */
  async saveToDbAsync(files: FileItem[]): Promise<void> {
    for (const file of files) {
      try {
        // 尝试更新（如果已存在）
        const updated = await apiService.updateFileRecord(file.id, {
          WJMC: file.name,
          WJLX: file.type.toUpperCase(),
          WJDX: file.size,
          GXRQ: file.updatedAt,
        });

        if (!updated) {
          // 不存在则插入
          await apiService.insertFileRecord({
            WJMC: file.name,
            WJLX: file.type.toUpperCase(),
            WJDX: file.size,
            GXRQ: file.updatedAt,
            BZ: '前端上传',
            XuHao: '1',
            sys_id: file.id,
            sys_user: 'uploader',
            sys_muser: 'uploader',
            sys_valid: 1,
            sys_batchid: apiService.generateUUID(),
            sys_epsid: apiService.generateUUID(),
          });
        }

        // 同步 attributes
        await apiService.syncAttributes(file.id, file.attributes);
      } catch (err) {
        console.warn(`[DB] 文件 ${file.name} 写入失败:`, err);
      }
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

    // 异步同步到数据库
    apiService.syncAttributes(fileId, newAttributes)
      .catch(e => console.warn('[DB] 同步属性失败:', e));

    return updatedFiles;
  },

  async deleteFile(fileId: string): Promise<boolean> {
    const deleted = await apiService.deleteFileWithRelations(fileId);
    if (!deleted) {
      throw new Error('删除后端文件记录失败');
    }
    return true;
  },

  /**
   * 创建上传草稿（不变，纯前端操作）
   */
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
      return {
        id: `upload-${now}-${index}`,
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
    return mockFiles.map(f => ({ ...f, attributes: cloneAttributes(f.attributes) }));
  },
};
