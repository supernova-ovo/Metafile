/**
 * 数据库核心数据访问层
 * 仿照 jetopApiService 的请求格式，修复参数传递方式
 * 
 * 区块 ID 映射：
 *   D_WJGL_WJ   (文件表)     → 76c22773-66cb-a51c-359b-5a2872169266
 *   D_WJGL_WH   (维度表)     → e7816f94-4a74-79b9-b7c6-c6aebe9f857b
 *   D_WJGL_BQ   (标签表)     → 92474142-10c1-3e46-6677-4b4322c7b1aa
 *   D_WJGL_WJBQ (文件标签关联) → 1971f501-6a69-bff0-c4f2-945c18db79c1
 *   D_WJGL_YHPH (用户偏好)   → 383be00c-b492-3ce0-373a-43b6a3bedaad
 */

import { generateUUID, encodeData, apiClient, getCurrentUserId } from './core/apiClient';

const SECTION_IDS = {
  FILES: '76c22773-66cb-a51c-359b-5a2872169266',
  DIMS: 'e7816f94-4a74-79b9-b7c6-c6aebe9f857b',
  TAGS: '92474142-10c1-3e46-6677-4b4322c7b1aa',
  FILE_TAGS: '1971f501-6a69-bff0-c4f2-945c18db79c1',
  PREFERENCES: '383be00c-b492-3ce0-373a-43b6a3bedaad',
} as const;

export { generateUUID };

// ============================================================
// 类型定义
// ============================================================

export interface FileRow {
  WJMC: string;
  WJLX: string;
  WJDX: number;
  GXRQ: string;
  BZ: string;
  Url?: string;
  sys_id: string;
  sys_user: string;
  sys_date?: string;
  sys_muser: string;
  sys_mdate?: string;
  sys_valid: number;
  sys_batchid: string;
  sys_epsid: string;
  XuHao: string;
  [key: string]: any;
}

export interface DimRow {
  WHMC: string;
  WHMS?: string;
  MRPX?: number;
  sys_id?: string;
  [key: string]: any;
}

export interface TagRow {
  WHID: string;
  BQZ: string;
  BZ?: string;
  sys_id?: string;
  [key: string]: any;
}

export interface FileTagRow {
  WJID: string;
  BQID: string;
  WHID: string;
  sys_id?: string;
  [key: string]: any;
}

export interface PrefRow {
  YHID: string;
  WHPX?: string;
  DQDL?: string;
  XZWJID?: string;
  sys_id?: string;
  [key: string]: any;
}

const dimNameToIdCache = new Map<string, string>();
const RETRIABLE_API_DELAYS_MS = [300, 900, 1800];
const FILE_RECORD_READY_DELAYS_MS = [200, 500, 1000, 2000, 3500];
// tagKeyToIdCache 已移至 syncAttributes 函数内部（局部变量），避免跨调用 stale 缓存问题

function buildTagKey(dimId: string, tagValue: string): string {
  return `${dimId}::${tagValue}`;
}

function isRetriableApiError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();
  return (
    normalized.includes('502') ||
    normalized.includes('503') ||
    normalized.includes('504') ||
    normalized.includes('bad gateway') ||
    normalized.includes('gateway timeout') ||
    normalized.includes('failed to fetch') ||
    normalized.includes('networkerror') ||
    normalized.includes('foreign key') ||
    normalized.includes('reference constraint') ||
    normalized.includes('conflicted with the reference') ||
    normalized.includes('insert conflicted') ||
    normalized.includes('wjid') ||
    normalized.includes('bqid') ||
    normalized.includes('whid') ||
    message.includes('外键') ||
    message.includes('引用') ||
    message.includes('关联') ||
    message.includes('约束')
  );
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function retryApiCall<T>(operation: string, fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt <= RETRIABLE_API_DELAYS_MS.length; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= RETRIABLE_API_DELAYS_MS.length || !isRetriableApiError(error)) {
        throw error;
      }
      console.warn(`[API_RETRY] ${operation} failed, retrying (${attempt + 1}/${RETRIABLE_API_DELAYS_MS.length})`, error);
      await wait(RETRIABLE_API_DELAYS_MS[attempt]);
    }
  }

  throw new Error(`${operation} failed`);
}

// ============================================================
// D_WJGL_WJ 文件表 CRUD
// ============================================================

export async function queryFiles(page = 1, pageSize = 200): Promise<{ ROWS: FileRow[]; TOTAL: number }> {
  const result = await apiClient({
    id: SECTION_IDS.FILES,
    mode: 'query',
    _pageindex: String(page),
    _pagesize: String(pageSize),
  });
  return { ROWS: result.ROWS || [], TOTAL: result.TOTAL || 0 };
}

async function queryFileById(sys_id: string): Promise<FileRow | null> {
  const result = await retryApiCall('queryFileById', () => apiClient({
    id: SECTION_IDS.FILES,
    mode: 'query',
    where: JSON.stringify({ sys_id }),
    _pageindex: '1',
    _pagesize: '1',
  }));
  const rows = result.ROWS || [];
  return rows.length > 0 ? rows[0] : null;
}

export async function waitForFileRecord(sys_id: string): Promise<boolean> {
  for (let attempt = 0; attempt <= FILE_RECORD_READY_DELAYS_MS.length; attempt += 1) {
    const row = await queryFileById(sys_id);
    if (row) return true;

    const delay = FILE_RECORD_READY_DELAYS_MS[attempt];
    if (delay === undefined) break;
    await wait(delay);
  }

  return false;
}

export async function insertFileRecord(record: FileRow): Promise<boolean> {
  const result = await apiClient({
    id: SECTION_IDS.FILES,
    mode: 'update',
    _p_data: encodeData({ updated: [record] }),
  });
  return result.STATUS === 'Success' || result.STATUS === 'OK';
}

export async function insertFileRecords(records: FileRow[]): Promise<boolean> {
  const result = await apiClient({
    id: SECTION_IDS.FILES,
    mode: 'update',
    _p_data: encodeData({ updated: records }),
  });
  return result.STATUS === 'Success' || result.STATUS === 'OK';
}

export async function updateFileRecord(sys_id: string, fields: Partial<FileRow>): Promise<boolean> {
  const result = await apiClient({
    id: SECTION_IDS.FILES,
    mode: 'update',
    _p_data: encodeData({ updated: [{ sys_id, ...fields }] }),
  });
  return result.STATUS === 'Success' || result.STATUS === 'OK';
}

export async function deleteFileRecord(sys_id: string): Promise<boolean> {
  for (let attempt = 0; attempt <= RETRIABLE_API_DELAYS_MS.length; attempt += 1) {
    try {
      const result = await apiClient({
        id: SECTION_IDS.FILES,
        mode: 'update',
        _p_data: encodeData({ deleted: [{ sys_id }] }),
      });
      if (result.STATUS === 'Success' || result.STATUS === 'OK') return true;
      if (!(await queryFileById(sys_id))) return true;
      return false;
    } catch (error) {
      if (!(await queryFileById(sys_id))) return true;
      if (attempt >= RETRIABLE_API_DELAYS_MS.length || !isRetriableApiError(error)) {
        throw error;
      }
      console.warn(`[API_RETRY] deleteFileRecord failed, retrying (${attempt + 1}/${RETRIABLE_API_DELAYS_MS.length})`, error);
      await wait(RETRIABLE_API_DELAYS_MS[attempt]);
    }
  }

  return false;
}

// ============================================================
// D_WJGL_WH 维度表 CRUD
// ============================================================

export async function queryAllDimensions(): Promise<DimRow[]> {
  const result = await apiClient({
    id: SECTION_IDS.DIMS,
    mode: 'query',
    _pageindex: '1',
    _pagesize: '100',
  });
  return result.ROWS || [];
}

export async function ensureDimension(whmc: string): Promise<string> {
  // 先查询是否存在
  const result = await apiClient({
    id: SECTION_IDS.DIMS,
    mode: 'query',
    where: JSON.stringify({ WHMC: whmc }),
    _pageindex: '1',
    _pagesize: '1',
  });

  const rows = result.ROWS || [];
  if (rows.length > 0) {
    return rows[0].sys_id;
  }

  // 不存在则创建（补全所有 NOT NULL 字段）
  const now = new Date().toISOString();
  const currentUserId = getCurrentUserId();
  const sys_id = generateUUID();
  const insertResult = await apiClient({
    id: SECTION_IDS.DIMS,
    mode: 'update',
    _p_data: encodeData({
      updated: [{
        sys_id,
        WHMC: whmc,
        WHMS: whmc,           // NOT NULL，用名称作为描述
        MRPX: 0,              // NOT NULL，默认排序0
        XuHao: '',            // NOT NULL
        sys_user: currentUserId,
        sys_date: now,        // NOT NULL
        sys_muser: currentUserId,
        sys_mdate: now,       // NOT NULL
        sys_valid: 1,
        sys_batchid: generateUUID(),
        sys_epsid: generateUUID(),
      }],
    }),
  });

  if (insertResult.STATUS === 'Success' || insertResult.STATUS === 'OK') {
    return sys_id;
  }
  throw new Error(`创建维度失败: ${whmc} (${JSON.stringify(insertResult)})`);
}

export async function updateDimension(sys_id: string, whmc: string): Promise<boolean> {
  const result = await apiClient({
    id: SECTION_IDS.DIMS,
    mode: 'update',
    _p_data: encodeData({ updated: [{ sys_id, WHMC: whmc, WHMS: whmc }] }),
  });
  return result.STATUS === 'Success' || result.STATUS === 'OK';
}

export async function deleteDimensionWithRelations(dimId: string): Promise<boolean> {
  // 1. 删除维度下的所有标签 (D_WJGL_BQ)
  const tags = await queryTagsByDim(dimId);
  if (tags.length > 0) {
    // 2. 准备要删除的关联文件-标签记录 (D_WJGL_WJBQ)
    const fileTagsResult = await apiClient({
      id: SECTION_IDS.FILE_TAGS,
      mode: 'query',
      where: JSON.stringify({ WHID: dimId }),
      _pageindex: '1',
      _pagesize: '10000',
    });
    const fileTags = fileTagsResult.ROWS || [];
    
    if (fileTags.length > 0) {
      const removeFileTagsResult = await apiClient({
        id: SECTION_IDS.FILE_TAGS,
        mode: 'update',
        _p_data: encodeData({ deleted: fileTags.map((r: any) => ({ sys_id: r.sys_id })) }),
      });
      if (!(removeFileTagsResult.STATUS === 'Success' || removeFileTagsResult.STATUS === 'OK')) {
        return false;
      }
    }

    const removeTagsResult = await apiClient({
      id: SECTION_IDS.TAGS,
      mode: 'update',
      _p_data: encodeData({ deleted: tags.map(t => ({ sys_id: t.sys_id })) }),
    });
    if (!(removeTagsResult.STATUS === 'Success' || removeTagsResult.STATUS === 'OK')) {
      return false;
    }
  }

  // 3. 删除维度本身 (D_WJGL_WH)
  const removeDimResult = await apiClient({
    id: SECTION_IDS.DIMS,
    mode: 'update',
    _p_data: encodeData({ deleted: [{ sys_id: dimId }] }),
  });

  return removeDimResult.STATUS === 'Success' || removeDimResult.STATUS === 'OK';
}

// ============================================================
// D_WJGL_BQ 标签表 CRUD
// ============================================================

export async function queryTagsByDim(dimId: string): Promise<TagRow[]> {
  const result = await apiClient({
    id: SECTION_IDS.TAGS,
    mode: 'query',
    where: JSON.stringify({ WHID: dimId }),
    _pageindex: '1',
    _pagesize: '200',
  });
  return result.ROWS || [];
}

export async function ensureTag(whid: string, bqz: string): Promise<string> {
  // 先查询同维度下是否存在同名标签
  const result = await apiClient({
    id: SECTION_IDS.TAGS,
    mode: 'query',
    where: JSON.stringify({ WHID: whid, BQZ: bqz }),
    _pageindex: '1',
    _pagesize: '1',
  });

  const rows = result.ROWS || [];
  if (rows.length > 0) {
    return rows[0].sys_id;
  }

  // 不存在则创建（补全所有 NOT NULL 字段）
  const now = new Date().toISOString();
  const currentUserId = getCurrentUserId();
  const sys_id = generateUUID();
  const insertResult = await apiClient({
    id: SECTION_IDS.TAGS,
    mode: 'update',
    _p_data: encodeData({
      updated: [{
        sys_id,
        WHID: whid,
        BQZ: bqz,
        BZ: '',               // NOT NULL
        XuHao: '',            // NOT NULL
        sys_user: currentUserId,
        sys_date: now,        // NOT NULL
        sys_muser: currentUserId,
        sys_mdate: now,       // NOT NULL
        sys_valid: 1,
        sys_batchid: generateUUID(),
        sys_epsid: generateUUID(),
      }],
    }),
  });

  if (insertResult.STATUS === 'Success' || insertResult.STATUS === 'OK') {
    return sys_id;
  }
  throw new Error(`创建标签失败: ${bqz} (${JSON.stringify(insertResult)})`);
}

export async function updateTag(sys_id: string, bqz: string): Promise<boolean> {
  const result = await apiClient({
    id: SECTION_IDS.TAGS,
    mode: 'update',
    _p_data: encodeData({ updated: [{ sys_id, BQZ: bqz }] }),
  });
  return result.STATUS === 'Success' || result.STATUS === 'OK';
}

async function queryTagById(tagId: string): Promise<TagRow | null> {
  const result = await retryApiCall('queryTagById', () => apiClient({
    id: SECTION_IDS.TAGS,
    mode: 'query',
    where: JSON.stringify({ sys_id: tagId }),
    _pageindex: '1',
    _pagesize: '1',
  }));
  const rows = result.ROWS || [];
  return rows.length > 0 ? rows[0] : null;
}

export async function deleteTagWithRelations(tagId: string): Promise<boolean> {
  const fileTagsResult = await apiClient({
    id: SECTION_IDS.FILE_TAGS,
    mode: 'query',
    where: JSON.stringify({ BQID: tagId }),
    _pageindex: '1',
    _pagesize: '10000',
  });
  const fileTags = fileTagsResult.ROWS || [];

  if (fileTags.length > 0) {
    const removeFileTagsResult = await apiClient({
      id: SECTION_IDS.FILE_TAGS,
      mode: 'update',
      _p_data: encodeData({ deleted: fileTags.map((r: any) => ({ sys_id: r.sys_id })) }),
    });
    if (!(removeFileTagsResult.STATUS === 'Success' || removeFileTagsResult.STATUS === 'OK')) {
      return false;
    }
  }

  const removeTagResult = await apiClient({
    id: SECTION_IDS.TAGS,
    mode: 'update',
    _p_data: encodeData({ deleted: [{ sys_id: tagId }] }),
  });
  return removeTagResult.STATUS === 'Success' || removeTagResult.STATUS === 'OK';
}

/**
 * 查询所有标签（含维度名称信息）
 */
export async function mergeTagInto(sourceTagId: string, targetTagId: string): Promise<boolean> {
  if (sourceTagId === targetTagId) return true;

  const targetTag = await queryTagById(targetTagId);
  if (!targetTag?.sys_id || !targetTag.WHID) {
    throw new Error('目标标签不存在，无法合并');
  }

  const sourceTag = await queryTagById(sourceTagId);
  if (!sourceTag?.sys_id) return true;

  const [sourceResult, targetResult] = await Promise.all([
    retryApiCall('querySourceTagRelations', () => apiClient({
      id: SECTION_IDS.FILE_TAGS,
      mode: 'query',
      where: JSON.stringify({ BQID: sourceTagId }),
      _pageindex: '1',
      _pagesize: '10000',
    })),
    retryApiCall('queryTargetTagRelations', () => apiClient({
      id: SECTION_IDS.FILE_TAGS,
      mode: 'query',
      where: JSON.stringify({ BQID: targetTagId }),
      _pageindex: '1',
      _pagesize: '10000',
    })),
  ]);

  const sourceAssocs = (sourceResult.ROWS || []) as FileTagRow[];
  const targetFileIds = new Set((targetResult.ROWS || []).map((row: FileTagRow) => row.WJID));
  const duplicateSourceAssocs = sourceAssocs
    .filter((row) => row.sys_id && targetFileIds.has(row.WJID))
    .map((row) => ({ sys_id: row.sys_id }));
  const assocsToMove = sourceAssocs
    .filter((row) => row.sys_id && !targetFileIds.has(row.WJID))
    .map((row) => ({ sys_id: row.sys_id, BQID: targetTagId, WHID: targetTag.WHID }));

  if (duplicateSourceAssocs.length > 0) {
    const removeDuplicatesResult = await retryApiCall('mergeTagRemoveDuplicateRelations', () => apiClient({
      id: SECTION_IDS.FILE_TAGS,
      mode: 'update',
      _p_data: encodeData({ deleted: duplicateSourceAssocs }),
    }));
    if (!(removeDuplicatesResult.STATUS === 'Success' || removeDuplicatesResult.STATUS === 'OK')) {
      return false;
    }
  }

  if (assocsToMove.length > 0) {
    const moveResult = await retryApiCall('mergeTagMoveRelations', () => apiClient({
      id: SECTION_IDS.FILE_TAGS,
      mode: 'update',
      _p_data: encodeData({ updated: assocsToMove }),
    }));
    if (!(moveResult.STATUS === 'Success' || moveResult.STATUS === 'OK')) {
      return false;
    }
  }

  const remainingSourceResult = await retryApiCall('queryRemainingSourceTagRelations', () => apiClient({
    id: SECTION_IDS.FILE_TAGS,
    mode: 'query',
    where: JSON.stringify({ BQID: sourceTagId }),
    _pageindex: '1',
    _pagesize: '1',
  }));
  if ((remainingSourceResult.ROWS || []).length > 0) {
    return false;
  }

  const removeSourceResult = await retryApiCall('mergeTagRemoveSourceTag', () => apiClient({
    id: SECTION_IDS.TAGS,
    mode: 'update',
    _p_data: encodeData({ deleted: [{ sys_id: sourceTagId }] }),
  }));
  if (removeSourceResult.STATUS === 'Success' || removeSourceResult.STATUS === 'OK') {
    return true;
  }

  return !(await queryTagById(sourceTagId));
}

export async function queryAllTags(): Promise<(TagRow & { WHMC?: string })[]> {
  const dims = await queryAllDimensions();
  const dimMap = new Map(dims.map(d => [d.sys_id!, d.WHMC]));

  const result = await apiClient({
    id: SECTION_IDS.TAGS,
    mode: 'query',
    _pageindex: '1',
    _pagesize: '5000',
  });

  const tags = (result.ROWS || []) as TagRow[];
  return tags.map(tag => ({
    ...tag,
    WHMC: dimMap.get(tag.WHID) || '',
  }));
}

// ============================================================
// D_WJGL_WJBQ 文件-标签关联表 CRUD
// ============================================================

export async function queryFileTags(fileId: string): Promise<FileTagRow[]> {
  const result = await apiClient({
    id: SECTION_IDS.FILE_TAGS,
    mode: 'query',
    where: JSON.stringify({ WJID: fileId }),
    _pageindex: '1',
    _pagesize: '200',
  });
  return result.ROWS || [];
}

export async function removeAllFileTags(fileId: string): Promise<boolean> {
  return retryApiCall('removeAllFileTags', async () => {
    const rows = await queryFileTags(fileId);
    const deleted = rows
      .filter((row) => row.sys_id)
      .map((row) => ({ sys_id: row.sys_id }));

    if (deleted.length === 0) return true;

    const removeResult = await apiClient({
      id: SECTION_IDS.FILE_TAGS,
      mode: 'update',
      _p_data: encodeData({ deleted }),
    });

    return removeResult.STATUS === 'Success' || removeResult.STATUS === 'OK';
  });
}

export async function deleteFileWithRelations(fileId: string): Promise<boolean> {
  const preferencesCleared = await clearFileReferencesFromPreferences(fileId);
  if (!preferencesCleared) return false;

  // 步骤1：删除文件-标签关联（D_WJGL_WJBQ）
  const relationsRemoved = await removeAllFileTags(fileId);
  if (!relationsRemoved) return false;

  // 步骤2：删除文件记录（D_WJGL_WJ）
  return deleteFileRecord(fileId);
}

// ============================================================
// D_WJGL_YHPH 用户偏好 CRUD
// ============================================================

const DEFAULT_USER_ID = 'metafile-default-user';

function getPreferenceUserId(): string {
  return getCurrentUserId(undefined, DEFAULT_USER_ID);
}

export async function getPreference(): Promise<PrefRow | null> {
  const userId = getPreferenceUserId();
  const result = await apiClient({
    id: SECTION_IDS.PREFERENCES,
    mode: 'query',
    where: JSON.stringify({ YHID: userId }),
    _pageindex: '1',
    _pagesize: '1',
  });

  const rows = result.ROWS || [];
  return rows.length > 0 ? rows[0] : null;
}

export async function upsertPreference(prefs: {
  dimensionOrder?: string[];
  currentPath?: string[];
  selectedFileId?: string | null;
}): Promise<boolean> {
  const existing = await getPreference();
  const userId = getPreferenceUserId();

  const fields: any = {};
  if (prefs.dimensionOrder !== undefined) fields.WHPX = JSON.stringify(prefs.dimensionOrder);
  if (prefs.currentPath !== undefined) fields.DQDL = JSON.stringify(prefs.currentPath);
  if (prefs.selectedFileId !== undefined) fields.XZWJID = prefs.selectedFileId || null;

  if (existing) {
    const result = await apiClient({
      id: SECTION_IDS.PREFERENCES,
      mode: 'update',
      _p_data: encodeData({ updated: [{ sys_id: existing.sys_id, ...fields }] }),
    });
    return result.STATUS === 'Success' || result.STATUS === 'OK';
  } else {
    const result = await apiClient({
      id: SECTION_IDS.PREFERENCES,
      mode: 'update',
      _p_data: encodeData({
        updated: [{
          sys_id: generateUUID(),
          YHID: userId,
          ...fields,
          sys_user: userId,
          sys_muser: userId,
          sys_valid: 1,
          sys_batchid: generateUUID(),
          sys_epsid: generateUUID(),
        }],
      }),
    });
    return result.STATUS === 'Success' || result.STATUS === 'OK';
  }
}

// ============================================================
// D_WJGL_YHPH 引用清理
// ============================================================

async function queryPreferencesBySelectedFile(fileId: string): Promise<PrefRow[]> {
  const result = await retryApiCall('queryPreferencesBySelectedFile', () => apiClient({
    id: SECTION_IDS.PREFERENCES,
    mode: 'query',
    where: JSON.stringify({ XZWJID: fileId }),
    _pageindex: '1',
    _pagesize: '10000',
  }));
  return result.ROWS || [];
}

async function clearFileReferencesFromPreferences(fileId: string): Promise<boolean> {
  return retryApiCall('clearFileReferencesFromPreferences', async () => {
    const rows = await queryPreferencesBySelectedFile(fileId);
    const updates = rows
      .filter((row) => row.sys_id)
      .map((row) => ({ sys_id: row.sys_id, XZWJID: null }));

    if (updates.length === 0) return true;

    const result = await apiClient({
      id: SECTION_IDS.PREFERENCES,
      mode: 'update',
      _p_data: encodeData({ updated: updates }),
    });
    return result.STATUS === 'Success' || result.STATUS === 'OK';
  });
}

// ============================================================
// 核心：attributes 同步逻辑
// ============================================================

/**
 * 将前端的 attributes 同步到数据库三表
 * D_WJGL_WH / D_WJGL_BQ / D_WJGL_WJBQ
 */
const syncLocks = new Map<string, Promise<void>>();

async function syncAttributesWithRetry(
  fileId: string,
  attributes: Record<string, string[]>
): Promise<void> {
  for (let attempt = 0; attempt <= RETRIABLE_API_DELAYS_MS.length; attempt += 1) {
    try {
      await _syncAttributesInner(fileId, attributes);
      return;
    } catch (error) {
      if (attempt >= RETRIABLE_API_DELAYS_MS.length || !isRetriableApiError(error)) {
        throw error;
      }
      await wait(RETRIABLE_API_DELAYS_MS[attempt]);
    }
  }
}

export async function syncAttributes(
  fileId: string,
  attributes: Record<string, string[]>
): Promise<void> {
  const currentLock = syncLocks.get(fileId) || Promise.resolve();
  const nextLock = currentLock.catch(() => undefined).then(async () => {
    await syncAttributesWithRetry(fileId, attributes);
  }).catch((e) => {
    console.error('[syncAttributes] 同步队列异常:', e);
    throw e;
  });
  syncLocks.set(fileId, nextLock);
  const clearLock = () => {
    if (syncLocks.get(fileId) === nextLock) {
      syncLocks.delete(fileId);
    }
  };
  void nextLock.then(clearLock, clearLock);
  return nextLock;
}

async function _syncAttributesInner(
  fileId: string,
  attributes: Record<string, string[]>
): Promise<void> {
  // 1) 读取当前文件现有关联（1 次 query）
  const existingAssocs = await queryFileTags(fileId);
  const existingByTagId = new Map(existingAssocs.map((a) => [a.BQID, a]));

  // 2) 归一化目标属性，去空、去重
  const normalizedTargets: Array<{ dimName: string; tagValue: string }> = [];
  const dedup = new Set<string>();
  for (const [dimNameRaw, tagValues] of Object.entries(attributes)) {
    const dimName = (dimNameRaw || '').trim();
    if (!dimName || !tagValues || tagValues.length === 0) continue;
    for (const tagValueRaw of tagValues) {
      const tagValue = (tagValueRaw || '').trim();
      if (!tagValue) continue;
      const key = `${dimName}::${tagValue}`;
      if (dedup.has(key)) continue;
      dedup.add(key);
      normalizedTargets.push({ dimName, tagValue });
    }
  }

  // 没有目标属性时，直接清理所有旧关联（1 次 remove）
  if (normalizedTargets.length === 0) {
    if (existingAssocs.length > 0) {
      await apiClient({
        id: SECTION_IDS.FILE_TAGS,
        mode: 'update',
        _p_data: encodeData({
          deleted: existingAssocs.map((row) => ({ sys_id: row.sys_id })),
        }),
      });
    }
    return;
  }

  // 3) 预热维度缓存（最多 1 次 query）
  if (dimNameToIdCache.size === 0) {
    const dims = await queryAllDimensions();
    for (const d of dims) {
      if (d.WHMC && d.sys_id) dimNameToIdCache.set(d.WHMC.trim(), d.sys_id);
    }
  }

  // 4) 缺失维度批量创建（1 次 update），并回填缓存
  const now = new Date().toISOString();
  const currentUserId = getCurrentUserId();
  const missingDimNames = [...new Set(normalizedTargets.map((t) => t.dimName))]
    .filter((name) => !dimNameToIdCache.has(name));
  if (missingDimNames.length > 0) {
    const createdDims = missingDimNames.map((name) => ({
      sys_id: generateUUID(),
      WHMC: name,
      WHMS: name,
      MRPX: 0,
      XuHao: '',
      sys_user: currentUserId,
      sys_date: now,
      sys_muser: currentUserId,
      sys_mdate: now,
      sys_valid: 1,
      sys_batchid: generateUUID(),
      sys_epsid: generateUUID(),
    }));

    const createDimResult = await apiClient({
      id: SECTION_IDS.DIMS,
      mode: 'update',
      _p_data: encodeData({ updated: createdDims }),
    });
    if (!(createDimResult.STATUS === 'Success' || createDimResult.STATUS === 'OK')) {
      throw new Error(`批量创建维度失败: ${JSON.stringify(createDimResult)}`);
    }
    for (const row of createdDims) {
      dimNameToIdCache.set(row.WHMC, row.sys_id);
    }
  }

  // 5) 每次调用都重新从数据库拉取最新标签，使用局部 Map 避免全局 stale 缓存
  const tagKeyToIdCache = new Map<string, string>();
  {
    const tags = await queryAllTags();
    for (const t of tags) {
      if (t.WHID && t.BQZ && t.sys_id) {
        tagKeyToIdCache.set(buildTagKey(t.WHID, t.BQZ.trim()), t.sys_id);
      }
    }
  }

  // 6) 缺失标签批量创建（1 次 update），并回填缓存
  const missingTags: Array<{ dimId: string; tagValue: string }> = [];
  for (const target of normalizedTargets) {
    const dimId = dimNameToIdCache.get(target.dimName);
    if (!dimId) continue;
    const tagKey = buildTagKey(dimId, target.tagValue);
    if (!tagKeyToIdCache.has(tagKey)) {
      missingTags.push({ dimId, tagValue: target.tagValue });
    }
  }

  if (missingTags.length > 0) {
    const createdTags = missingTags.map((t) => ({
      sys_id: generateUUID(),
      WHID: t.dimId,
      BQZ: t.tagValue,
      BZ: '',
      XuHao: '',
      sys_user: currentUserId,
      sys_date: now,
      sys_muser: currentUserId,
      sys_mdate: now,
      sys_valid: 1,
      sys_batchid: generateUUID(),
      sys_epsid: generateUUID(),
    }));
    const createTagResult = await apiClient({
      id: SECTION_IDS.TAGS,
      mode: 'update',
      _p_data: encodeData({ updated: createdTags }),
    });
    if (!(createTagResult.STATUS === 'Success' || createTagResult.STATUS === 'OK')) {
      throw new Error(`批量创建标签失败: ${JSON.stringify(createTagResult)}`);
    }
    for (const row of createdTags) {
      tagKeyToIdCache.set(buildTagKey(row.WHID, row.BQZ), row.sys_id);
    }
  }

  // 7) 计算目标关联集合
  const targetAssocs: Array<{ BQID: string; WHID: string }> = [];
  for (const target of normalizedTargets) {
    const dimId = dimNameToIdCache.get(target.dimName);
    if (!dimId) continue;
    const tagId = tagKeyToIdCache.get(buildTagKey(dimId, target.tagValue));
    if (!tagId) continue;
    targetAssocs.push({ BQID: tagId, WHID: dimId });
  }
  const targetTagIdSet = new Set(targetAssocs.map((t) => t.BQID));

  // 8) 批量新增缺失关联（1 次 update）
  const toCreateAssocs = targetAssocs
    .filter((t) => !existingByTagId.has(t.BQID))
    .map((t) => ({
      sys_id: generateUUID(),
      WJID: fileId,
      BQID: t.BQID,
      WHID: t.WHID,
      BZ: '',
      XuHao: '',
      sys_user: currentUserId,
      sys_date: now,
      sys_muser: currentUserId,
      sys_mdate: now,
      sys_valid: 1,
      sys_batchid: generateUUID(),
      sys_epsid: generateUUID(),
    }));

  if (toCreateAssocs.length > 0) {
    const createAssocResult = await apiClient({
      id: SECTION_IDS.FILE_TAGS,
      mode: 'update',
      _p_data: encodeData({ updated: toCreateAssocs }),
    });
    if (!(createAssocResult.STATUS === 'Success' || createAssocResult.STATUS === 'OK')) {
      throw new Error(`批量创建文件标签关联失败: ${JSON.stringify(createAssocResult)}`);
    }
  }

  // 9) 批量删除多余关联（1 次 remove）
  const toDeleteAssocs = existingAssocs
    .filter((assoc) => !targetTagIdSet.has(assoc.BQID))
    .map((assoc) => ({ sys_id: assoc.sys_id }));
  if (toDeleteAssocs.length > 0) {
    const removeAssocResult = await apiClient({
      id: SECTION_IDS.FILE_TAGS,
      mode: 'update',
      _p_data: encodeData({ deleted: toDeleteAssocs }),
    });
    if (!(removeAssocResult.STATUS === 'Success' || removeAssocResult.STATUS === 'OK')) {
      throw new Error(`批量删除文件标签关联失败: ${JSON.stringify(removeAssocResult)}`);
    }
  }
}

/**
 * 根据文件 ID 加载完整的 attributes
 */
export async function loadFileAttributes(fileId: string): Promise<Record<string, string[]>> {
  const assocs = await queryFileTags(fileId);
  if (assocs.length === 0) return {};

  const dimIds = [...new Set(assocs.map(a => a.WHID))];
  const tagIds = [...new Set(assocs.map(a => a.BQID))];

  // 查询维度名称
  const dimPromises = dimIds.map(async (did) => {
    const result = await apiClient({
      id: SECTION_IDS.DIMS,
      mode: 'query',
      where: JSON.stringify({ sys_id: did }),
      _pageindex: '1',
      _pagesize: '1',
    });
    return result.ROWS?.[0] || null;
  });
  const dimRows = await Promise.all(dimPromises);
  const dimMap = new Map<string, string>();
  for (const row of dimRows) {
    if (row) dimMap.set(row.sys_id, row.WHMC);
  }

  // 查询标签值
  const tagPromises = tagIds.map(async (tid) => {
    const result = await apiClient({
      id: SECTION_IDS.TAGS,
      mode: 'query',
      where: JSON.stringify({ sys_id: tid }),
      _pageindex: '1',
      _pagesize: '1',
    });
    return result.ROWS?.[0] || null;
  });
  const tagRows = await Promise.all(tagPromises);
  const tagMap = new Map<string, { value: string; dimId: string }>();
  for (const row of tagRows) {
    if (row) tagMap.set(row.sys_id, { value: row.BQZ, dimId: row.WHID });
  }

  const attrs: Record<string, Set<string>> = {};
  for (const assoc of assocs) {
    const dimName = dimMap.get(assoc.WHID) || assoc.WHID;
    if (!attrs[dimName]) attrs[dimName] = new Set();
    const tagInfo = tagMap.get(assoc.BQID);
    if (tagInfo) attrs[dimName].add(tagInfo.value);
  }

  const result: Record<string, string[]> = {};
  for (const [dim, vals] of Object.entries(attrs)) {
    result[dim] = [...vals];
  }
  return result;
}

export async function loadAllFileAttributes(): Promise<Record<string, Record<string, string[]>>> {
  const [assocsR, dimsR, tagsR] = await Promise.all([
    apiClient({ id: SECTION_IDS.FILE_TAGS, mode: 'query', _pageindex: '1', _pagesize: '10000' }),
    apiClient({ id: SECTION_IDS.DIMS, mode: 'query', _pageindex: '1', _pagesize: '5000' }),
    apiClient({ id: SECTION_IDS.TAGS, mode: 'query', _pageindex: '1', _pagesize: '5000' }),
  ]);

  const assocs = assocsR.ROWS || [];
  const dims = dimsR.ROWS || [];
  const tags = tagsR.ROWS || [];

  const dimNameById = new Map<string, string>();
  for (const d of dims) {
    if (d.sys_id && d.WHMC) dimNameById.set(d.sys_id, d.WHMC);
  }

  const tagById = new Map<string, { value: string; dimId: string }>();
  for (const t of tags) {
    if (t.sys_id && t.BQZ) tagById.set(t.sys_id, { value: t.BQZ, dimId: t.WHID });
  }

  const result: Record<string, Record<string, Set<string>>> = {};
  for (const a of assocs) {
    const fileId = a.WJID;
    const tagInfo = tagById.get(a.BQID);
    if (!fileId || !tagInfo) continue;
    const dimName = dimNameById.get(a.WHID) || dimNameById.get(tagInfo.dimId);
    if (!dimName) continue;

    if (!result[fileId]) result[fileId] = {};
    if (!result[fileId][dimName]) result[fileId][dimName] = new Set<string>();
    result[fileId][dimName].add(tagInfo.value);
  }

  const normalized: Record<string, Record<string, string[]>> = {};
  for (const [fileId, attrs] of Object.entries(result)) {
    normalized[fileId] = {};
    for (const [dimName, values] of Object.entries(attrs)) {
      normalized[fileId][dimName] = [...values];
    }
  }
  return normalized;
}

export async function auditFileTagRelations(): Promise<{
  files: number;
  tags: number;
  assocs: number;
  dims: number;
  filesWithoutTags: number;
  badFileRef: number;
  badTagRef: number;
  badDimRef: number;
}> {
  const [filesR, tagsR, assocsR, dimsR] = await Promise.all([
    apiClient({ id: SECTION_IDS.FILES, mode: 'query', _pageindex: '1', _pagesize: '5000' }),
    apiClient({ id: SECTION_IDS.TAGS, mode: 'query', _pageindex: '1', _pagesize: '5000' }),
    apiClient({ id: SECTION_IDS.FILE_TAGS, mode: 'query', _pageindex: '1', _pagesize: '10000' }),
    apiClient({ id: SECTION_IDS.DIMS, mode: 'query', _pageindex: '1', _pagesize: '5000' }),
  ]);

  const files = filesR.ROWS || [];
  const tags = tagsR.ROWS || [];
  const assocs = assocsR.ROWS || [];
  const dims = dimsR.ROWS || [];

  const fileIds = new Set(files.map((r: any) => r.sys_id));
  const tagIds = new Set(tags.map((r: any) => r.sys_id));
  const dimIds = new Set(dims.map((r: any) => r.sys_id));
  const assocFileIds = new Set(assocs.map((a: any) => a.WJID));

  const badFileRef = assocs.filter((a: any) => !fileIds.has(a.WJID)).length;
  const badTagRef = assocs.filter((a: any) => !tagIds.has(a.BQID)).length;
  const badDimRef = assocs.filter((a: any) => !dimIds.has(a.WHID)).length;
  const filesWithoutTags = files.filter((f: any) => !assocFileIds.has(f.sys_id)).length;

  return {
    files: files.length,
    tags: tags.length,
    assocs: assocs.length,
    dims: dims.length,
    filesWithoutTags,
    badFileRef,
    badTagRef,
    badDimRef,
  };
}

// 暴露给控制台供测试使用
if (typeof window !== 'undefined') {
  (window as any).apiService = {
    queryFiles, insertFileRecord, insertFileRecords, updateFileRecord, deleteFileRecord,
    queryAllDimensions, ensureDimension, queryTagsByDim, ensureTag, updateTag, deleteTagWithRelations, mergeTagInto, queryAllTags,
    queryFileTags, removeAllFileTags, deleteFileWithRelations,
    getPreference, upsertPreference, waitForFileRecord, syncAttributes, loadFileAttributes, loadAllFileAttributes,
    auditFileTagRelations
  };
}

