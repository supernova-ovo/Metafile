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

const SECTION_IDS = {
  FILES: '76c22773-66cb-a51c-359b-5a2872169266',
  DIMS: 'e7816f94-4a74-79b9-b7c6-c6aebe9f857b',
  TAGS: '92474142-10c1-3e46-6677-4b4322c7b1aa',
  FILE_TAGS: '1971f501-6a69-bff0-c4f2-945c18db79c1',
  PREFERENCES: '383be00c-b492-3ce0-373a-43b6a3bedaad',
} as const;

// 使用相对路径走 Vite 代理，避免 CORS 问题
const API_HANDLER_URL = '/ks/sectionHandler.ashx';

// ============================================================
// 内部工具函数（与 jetopApiService 保持一致）
// ============================================================

export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16).toUpperCase();
  });
}

function getAuthToken(): string {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_AUTH_TOKEN) {
    return import.meta.env.VITE_AUTH_TOKEN as string;
  }
  return '';
}

function buildFormData(fields: Record<string, string>): { boundary: string; body: string } {
  const boundary = `----FormBoundary${Date.now()}${Math.random().toString(36).substring(2)}`;
  const parts: string[] = [];
  for (const [name, value] of Object.entries(fields)) {
    parts.push(`--${boundary}\r\n`);
    parts.push(`Content-Disposition: form-data; name="${name}"\r\n\r\n`);
    parts.push(`${value}\r\n`);
  }
  parts.push(`--${boundary}--\r\n`);
  return { boundary, body: parts.join('') };
}

/**
 * 直接发送表单字段到 sectionHandler（与 jetopApiService 一致）
 * 查询参数（_pageindex, _pagesize, where）作为顶级表单字段
 * 插入/更新/删除数据放在 'data' 字段（Base64 编码）
 */
async function apiRequest(formFields: Record<string, string>): Promise<any> {
  const token = getAuthToken();
  const { boundary, body } = buildFormData(formFields);

  const response = await fetch(API_HANDLER_URL, {
    method: 'POST',
    headers: {
      'X-JetopDebug-User': token,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`HTTP错误: ${response.status} ${response.statusText}`);
  }

  const text = await response.text();
  return JSON.parse(text);
}

/**
 * Base64 编码数据（用于 insert/update/remove 的 payload）
 */
function encodeData(obj: any): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(obj))));
}

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
  sys_muser: string;
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

// ============================================================
// D_WJGL_WJ 文件表 CRUD
// ============================================================

export async function queryFiles(page = 1, pageSize = 200): Promise<{ ROWS: FileRow[]; TOTAL: number }> {
  const result = await apiRequest({
    id: SECTION_IDS.FILES,
    mode: 'query',
    _pageindex: String(page),
    _pagesize: String(pageSize),
  });
  return { ROWS: result.ROWS || [], TOTAL: result.TOTAL || 0 };
}

export async function insertFileRecord(record: FileRow): Promise<boolean> {
  const result = await apiRequest({
    id: SECTION_IDS.FILES,
    mode: 'insert',
    data: encodeData({ inserted: [record] }),
  });
  return result.STATUS === 'Success' || result.STATUS === 'OK';
}

export async function insertFileRecords(records: FileRow[]): Promise<boolean> {
  const result = await apiRequest({
    id: SECTION_IDS.FILES,
    mode: 'insert',
    data: encodeData({ inserted: records }),
  });
  return result.STATUS === 'Success' || result.STATUS === 'OK';
}

export async function updateFileRecord(sys_id: string, fields: Partial<FileRow>): Promise<boolean> {
  const result = await apiRequest({
    id: SECTION_IDS.FILES,
    mode: 'update',
    data: encodeData({ updated: [{ sys_id, ...fields }] }),
  });
  return result.STATUS === 'Success' || result.STATUS === 'OK';
}

export async function deleteFileRecord(sys_id: string): Promise<boolean> {
  const result = await apiRequest({
    id: SECTION_IDS.FILES,
    mode: 'remove',
    data: encodeData({ deleted: [{ sys_id }] }),
  });
  return result.STATUS === 'Success' || result.STATUS === 'OK';
}

// ============================================================
// D_WJGL_WH 维度表 CRUD
// ============================================================

export async function queryAllDimensions(): Promise<DimRow[]> {
  const result = await apiRequest({
    id: SECTION_IDS.DIMS,
    mode: 'query',
    _pageindex: '1',
    _pagesize: '100',
  });
  return result.ROWS || [];
}

export async function ensureDimension(whmc: string): Promise<string> {
  // 先查询是否存在
  const result = await apiRequest({
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

  // 不存在则创建
  const sys_id = generateUUID();
  const insertResult = await apiRequest({
    id: SECTION_IDS.DIMS,
    mode: 'insert',
    data: encodeData({
      inserted: [{
        sys_id,
        WHMC: whmc,
        sys_user: 'metafile',
        sys_muser: 'metafile',
        sys_valid: 1,
        sys_batchid: generateUUID(),
        sys_epsid: generateUUID(),
      }],
    }),
  });

  if (insertResult.STATUS === 'Success' || insertResult.STATUS === 'OK') {
    return sys_id;
  }
  throw new Error(`创建维度失败: ${whmc}`);
}

// ============================================================
// D_WJGL_BQ 标签表 CRUD
// ============================================================

export async function queryTagsByDim(dimId: string): Promise<TagRow[]> {
  const result = await apiRequest({
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
  const result = await apiRequest({
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

  // 不存在则创建
  const sys_id = generateUUID();
  const insertResult = await apiRequest({
    id: SECTION_IDS.TAGS,
    mode: 'insert',
    data: encodeData({
      inserted: [{
        sys_id,
        WHID: whid,
        BQZ: bqz,
        sys_user: 'metafile',
        sys_muser: 'metafile',
        sys_valid: 1,
        sys_batchid: generateUUID(),
        sys_epsid: generateUUID(),
      }],
    }),
  });

  if (insertResult.STATUS === 'Success' || insertResult.STATUS === 'OK') {
    return sys_id;
  }
  throw new Error(`创建标签失败: ${bqz}`);
}

/**
 * 查询所有标签（含维度名称信息）
 */
export async function queryAllTags(): Promise<(TagRow & { WHMC?: string })[]> {
  const dims = await queryAllDimensions();
  const dimMap = new Map(dims.map(d => [d.sys_id!, d.WHMC]));

  const result = await apiRequest({
    id: SECTION_IDS.TAGS,
    mode: 'query',
    _pageindex: '1',
    _pagesize: '500',
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
  const result = await apiRequest({
    id: SECTION_IDS.FILE_TAGS,
    mode: 'query',
    where: JSON.stringify({ WJID: fileId }),
    _pageindex: '1',
    _pagesize: '200',
  });
  return result.ROWS || [];
}

async function ensureFileTag(wjid: string, bqid: string, whid: string): Promise<boolean> {
  const result = await apiRequest({
    id: SECTION_IDS.FILE_TAGS,
    mode: 'query',
    where: JSON.stringify({ WJID: wjid, BQID: bqid }),
    _pageindex: '1',
    _pagesize: '1',
  });

  const rows = result.ROWS || [];
  if (rows.length > 0) return true;

  const insertResult = await apiRequest({
    id: SECTION_IDS.FILE_TAGS,
    mode: 'insert',
    data: encodeData({
      inserted: [{
        sys_id: generateUUID(),
        WJID: wjid,
        BQID: bqid,
        WHID: whid,
        sys_user: 'metafile',
        sys_muser: 'metafile',
        sys_valid: 1,
        sys_batchid: generateUUID(),
        sys_epsid: generateUUID(),
      }],
    }),
  });

  return insertResult.STATUS === 'Success' || insertResult.STATUS === 'OK';
}

async function removeFileTag(wjid: string, bqid: string): Promise<boolean> {
  const result = await apiRequest({
    id: SECTION_IDS.FILE_TAGS,
    mode: 'query',
    where: JSON.stringify({ WJID: wjid, BQID: bqid }),
    _pageindex: '1',
    _pagesize: '1',
  });

  const rows = result.ROWS || [];
  if (rows.length === 0) return true;

  const removeResult = await apiRequest({
    id: SECTION_IDS.FILE_TAGS,
    mode: 'remove',
    data: encodeData({
      deleted: rows.map((r: any) => ({ sys_id: r.sys_id })),
    }),
  });

  return removeResult.STATUS === 'Success' || removeResult.STATUS === 'OK';
}

// ============================================================
// D_WJGL_YHPH 用户偏好 CRUD
// ============================================================

const DEFAULT_USER_ID = 'metafile-default-user';

export async function getPreference(): Promise<PrefRow | null> {
  const result = await apiRequest({
    id: SECTION_IDS.PREFERENCES,
    mode: 'query',
    where: JSON.stringify({ YHID: DEFAULT_USER_ID }),
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

  const fields: any = {};
  if (prefs.dimensionOrder !== undefined) fields.WHPX = JSON.stringify(prefs.dimensionOrder);
  if (prefs.currentPath !== undefined) fields.DQDL = JSON.stringify(prefs.currentPath);
  if (prefs.selectedFileId !== undefined) fields.XZWJID = prefs.selectedFileId || null;

  if (existing) {
    const result = await apiRequest({
      id: SECTION_IDS.PREFERENCES,
      mode: 'update',
      data: encodeData({ updated: [{ sys_id: existing.sys_id, ...fields }] }),
    });
    return result.STATUS === 'Success' || result.STATUS === 'OK';
  } else {
    const result = await apiRequest({
      id: SECTION_IDS.PREFERENCES,
      mode: 'insert',
      data: encodeData({
        inserted: [{
          sys_id: generateUUID(),
          YHID: DEFAULT_USER_ID,
          ...fields,
          sys_user: 'metafile',
          sys_muser: 'metafile',
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
// 核心：attributes 同步逻辑
// ============================================================

/**
 * 将前端的 attributes 同步到数据库三表
 * D_WJGL_WH / D_WJGL_BQ / D_WJGL_WJBQ
 */
export async function syncAttributes(
  fileId: string,
  attributes: Record<string, string[]>
): Promise<void> {
  const existingAssocs = await queryFileTags(fileId);
  const newBqIds = new Set<string>();

  for (const [dimName, tagValues] of Object.entries(attributes)) {
    if (!tagValues || tagValues.length === 0) continue;

    const dimId = await ensureDimension(dimName);

    for (const tagValue of tagValues) {
      if (!tagValue.trim()) continue;
      const tagId = await ensureTag(dimId, tagValue.trim());
      newBqIds.add(tagId);
      await ensureFileTag(fileId, tagId, dimId);
    }
  }

  // 删除不再需要的关联
  for (const assoc of existingAssocs) {
    if (!newBqIds.has(assoc.BQID)) {
      await removeFileTag(fileId, assoc.BQID);
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
    const result = await apiRequest({
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
    const result = await apiRequest({
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
