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
const API_METRICS_ENABLED = typeof import.meta !== 'undefined' ? !!import.meta.env?.DEV : true;
const API_METRICS_WINDOW_MS = 5000;
const API_SLOW_REQUEST_MS = 400;
const API_PAYLOAD_DEBUG_ENABLED = true;

type ApiMode = 'query' | 'update' | 'remove' | 'other';
type ApiMetricBucket = { total: number; fail: number; slow: number; duration: number };

const metricsState = {
  timer: null as ReturnType<typeof setTimeout> | null,
  startedAt: 0,
  total: 0,
  fail: 0,
  slow: 0,
  mode: new Map<ApiMode, number>(),
  section: new Map<string, ApiMetricBucket>(),
};

function compactId(id?: string): string {
  if (!id) return 'unknown';
  return `${id.slice(0, 6)}...${id.slice(-4)}`;
}

function normalizeMode(mode?: string): ApiMode {
  if (mode === 'query' || mode === 'update' || mode === 'remove') return mode;
  return 'other';
}

function resetMetricsWindow() {
  metricsState.startedAt = Date.now();
  metricsState.total = 0;
  metricsState.fail = 0;
  metricsState.slow = 0;
  metricsState.mode.clear();
  metricsState.section.clear();
}

function flushApiMetrics() {
  metricsState.timer = null;
  if (metricsState.total === 0) return;

  const elapsedSec = Math.max(1, Math.round((Date.now() - metricsState.startedAt) / 1000));
  const q = metricsState.mode.get('query') || 0;
  const u = metricsState.mode.get('update') || 0;
  const r = metricsState.mode.get('remove') || 0;
  const topSections = [...metricsState.section.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 3)
    .map(([id, m]) => `${compactId(id)}:${m.total}${m.fail > 0 ? `!${m.fail}` : ''}`)
    .join(', ');

  console.log(
    `[API_METRICS ${elapsedSec}s] total=${metricsState.total} query=${q} update=${u} remove=${r} fail=${metricsState.fail} slow>${API_SLOW_REQUEST_MS}ms=${metricsState.slow} top=[${topSections}]`
  );
  resetMetricsWindow();
}

function recordApiMetric(formFields: Record<string, string>, durationMs: number, failed: boolean) {
  if (!API_METRICS_ENABLED) return;
  if (!metricsState.startedAt) resetMetricsWindow();

  const mode = normalizeMode(formFields.mode);
  const id = formFields.id || 'unknown';

  metricsState.total += 1;
  if (failed) metricsState.fail += 1;
  if (durationMs >= API_SLOW_REQUEST_MS) metricsState.slow += 1;
  metricsState.mode.set(mode, (metricsState.mode.get(mode) || 0) + 1);

  const bucket = metricsState.section.get(id) || { total: 0, fail: 0, slow: 0, duration: 0 };
  bucket.total += 1;
  if (failed) bucket.fail += 1;
  if (durationMs >= API_SLOW_REQUEST_MS) bucket.slow += 1;
  bucket.duration += durationMs;
  metricsState.section.set(id, bucket);

  if (!metricsState.timer) {
    metricsState.timer = setTimeout(flushApiMetrics, API_METRICS_WINDOW_MS);
  }
}

function safeDecodePayload(data?: string): any {
  if (!data) return undefined;
  try {
    return JSON.parse(decodeURIComponent(escape(atob(data))));
  } catch {
    return '[decode_failed]';
  }
}

function logApiPayload(formFields: Record<string, string>) {
  if (!API_PAYLOAD_DEBUG_ENABLED) return;
  if (formFields.mode === 'query') return;
  const rawData = safeDecodePayload((formFields._p_data ?? formFields.data));
  const payloadPreview = {
    id: formFields.id,
    mode: formFields.mode,
    where: formFields.where,
    _pageindex: formFields._pageindex,
    _pagesize: formFields._pagesize,
    rawData,
  };
  console.groupCollapsed(`[API_PAYLOAD] ${formFields.mode} id=${formFields.id}`);
  console.dir(payloadPreview, { depth: null });
  console.groupEnd();
}

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
  const start = performance.now();
  logApiPayload(formFields);
  const token = getAuthToken();

  const processedFields = { ...formFields };
  
  if (processedFields.where) {
    try {
      const whereObj = JSON.parse(processedFields.where);
      delete processedFields.where;
      for (const key of Object.keys(whereObj)) {
        processedFields[`_p_${key}`] = String(whereObj[key]);
      }
    } catch (e) {
      console.warn('[API] 解析 where 参数失败', e);
    }
  }

  const { boundary, body } = buildFormData(processedFields);

  try {
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
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      // 后端返回了非 JSON 内容（如 SQL 错误明文），直接报错
      console.error('[API_RESPONSE_NOT_JSON]', { mode: formFields.mode, id: formFields.id, rawText: text });
      throw new Error(`后端返回非JSON响应: ${text}`);
    }
    const mode = formFields.mode;
    const isMutation = mode === 'update' || mode === 'remove';
    const status = parsed?.STATUS;
    if (isMutation && !(status === 'Success' || status === 'OK')) {
      console.error('[API_MUTATION_FAILED]', {
        id: formFields.id,
        mode,
        status,
        message: parsed?.MSG || parsed?.MESSAGE || parsed?.message,
        response: parsed,
      });
      recordApiMetric(formFields, performance.now() - start, true);
      throw new Error(`后端写入失败: ${status || 'UNKNOWN'} ${parsed?.MSG || parsed?.MESSAGE || ''}`.trim());
    }
    recordApiMetric(formFields, performance.now() - start, false);
    return parsed;
  } catch (error) {
    recordApiMetric(formFields, performance.now() - start, true);
    throw error;
  }
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
const tagKeyToIdCache = new Map<string, string>(); // `${dimId}::${tagValue}`

function buildTagKey(dimId: string, tagValue: string): string {
  return `${dimId}::${tagValue}`;
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
    mode: 'update',
    _p_data: encodeData({ updated: [record] }),
  });
  return result.STATUS === 'Success' || result.STATUS === 'OK';
}

export async function insertFileRecords(records: FileRow[]): Promise<boolean> {
  const result = await apiRequest({
    id: SECTION_IDS.FILES,
    mode: 'update',
    _p_data: encodeData({ updated: records }),
  });
  return result.STATUS === 'Success' || result.STATUS === 'OK';
}

export async function updateFileRecord(sys_id: string, fields: Partial<FileRow>): Promise<boolean> {
  const result = await apiRequest({
    id: SECTION_IDS.FILES,
    mode: 'update',
    _p_data: encodeData({ updated: [{ sys_id, ...fields }] }),
  });
  return result.STATUS === 'Success' || result.STATUS === 'OK';
}

export async function deleteFileRecord(sys_id: string): Promise<boolean> {
  const result = await apiRequest({
    id: SECTION_IDS.FILES,
    mode: 'update',
    _p_data: encodeData({ deleted: [{ sys_id }] }),
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

  // 不存在则创建（补全所有 NOT NULL 字段）
  const now = new Date().toISOString();
  const sys_id = generateUUID();
  const insertResult = await apiRequest({
    id: SECTION_IDS.DIMS,
    mode: 'update',
    _p_data: encodeData({
      updated: [{
        sys_id,
        WHMC: whmc,
        WHMS: whmc,           // NOT NULL，用名称作为描述
        MRPX: 0,              // NOT NULL，默认排序0
        XuHao: '',            // NOT NULL
        sys_user: 'metafile',
        sys_date: now,        // NOT NULL
        sys_muser: 'metafile',
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

  // 不存在则创建（补全所有 NOT NULL 字段）
  const now = new Date().toISOString();
  const sys_id = generateUUID();
  const insertResult = await apiRequest({
    id: SECTION_IDS.TAGS,
    mode: 'update',
    _p_data: encodeData({
      updated: [{
        sys_id,
        WHID: whid,
        BQZ: bqz,
        BZ: '',               // NOT NULL
        XuHao: '',            // NOT NULL
        sys_user: 'metafile',
        sys_date: now,        // NOT NULL
        sys_muser: 'metafile',
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

export async function removeAllFileTags(fileId: string): Promise<boolean> {
  const rows = await queryFileTags(fileId);
  if (rows.length === 0) return true;

  const removeResult = await apiRequest({
    id: SECTION_IDS.FILE_TAGS,
    mode: 'update',
    _p_data: encodeData({
      deleted: rows.map((row) => ({ sys_id: row.sys_id })),
    }),
  });

  return removeResult.STATUS === 'Success' || removeResult.STATUS === 'OK';
}

export async function deleteFileWithRelations(fileId: string): Promise<boolean> {
  const relationsRemoved = await removeAllFileTags(fileId);
  if (!relationsRemoved) return false;
  return deleteFileRecord(fileId);
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
      _p_data: encodeData({ updated: [{ sys_id: existing.sys_id, ...fields }] }),
    });
    return result.STATUS === 'Success' || result.STATUS === 'OK';
  } else {
    const result = await apiRequest({
      id: SECTION_IDS.PREFERENCES,
      mode: 'update',
      _p_data: encodeData({
        updated: [{
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
      await apiRequest({
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
  const missingDimNames = [...new Set(normalizedTargets.map((t) => t.dimName))]
    .filter((name) => !dimNameToIdCache.has(name));
  if (missingDimNames.length > 0) {
    const createdDims = missingDimNames.map((name) => ({
      sys_id: generateUUID(),
      WHMC: name,
      WHMS: name,
      MRPX: 0,
      XuHao: '',
      sys_user: 'metafile',
      sys_date: now,
      sys_muser: 'metafile',
      sys_mdate: now,
      sys_valid: 1,
      sys_batchid: generateUUID(),
      sys_epsid: generateUUID(),
    }));

    const createDimResult = await apiRequest({
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

  // 5) 预热标签缓存（最多 1 次 query）
  if (tagKeyToIdCache.size === 0) {
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
      sys_user: 'metafile',
      sys_date: now,
      sys_muser: 'metafile',
      sys_mdate: now,
      sys_valid: 1,
      sys_batchid: generateUUID(),
      sys_epsid: generateUUID(),
    }));
    const createTagResult = await apiRequest({
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
      sys_user: 'metafile',
      sys_date: now,
      sys_muser: 'metafile',
      sys_mdate: now,
      sys_valid: 1,
      sys_batchid: generateUUID(),
      sys_epsid: generateUUID(),
    }));

  if (toCreateAssocs.length > 0) {
    const createAssocResult = await apiRequest({
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
    const removeAssocResult = await apiRequest({
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

export async function loadAllFileAttributes(): Promise<Record<string, Record<string, string[]>>> {
  const [assocsR, dimsR, tagsR] = await Promise.all([
    apiRequest({ id: SECTION_IDS.FILE_TAGS, mode: 'query', _pageindex: '1', _pagesize: '10000' }),
    apiRequest({ id: SECTION_IDS.DIMS, mode: 'query', _pageindex: '1', _pagesize: '5000' }),
    apiRequest({ id: SECTION_IDS.TAGS, mode: 'query', _pageindex: '1', _pagesize: '5000' }),
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
    apiRequest({ id: SECTION_IDS.FILES, mode: 'query', _pageindex: '1', _pagesize: '5000' }),
    apiRequest({ id: SECTION_IDS.TAGS, mode: 'query', _pageindex: '1', _pagesize: '5000' }),
    apiRequest({ id: SECTION_IDS.FILE_TAGS, mode: 'query', _pageindex: '1', _pagesize: '10000' }),
    apiRequest({ id: SECTION_IDS.DIMS, mode: 'query', _pageindex: '1', _pagesize: '5000' }),
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
    queryAllDimensions, ensureDimension, queryTagsByDim, ensureTag, queryAllTags,
    queryFileTags, removeAllFileTags, deleteFileWithRelations,
    getPreference, upsertPreference, syncAttributes, loadFileAttributes, loadAllFileAttributes,
    auditFileTagRelations
  };
}

