/**
 * Jetop 后端数据同步服务
 * 
 * 完整上传流程：
 * 1. 上传文件本体到 upload_json.ashx，获取公网 URL
 * 2. 将文件元数据（含 URL）写入后端区块 76c22773-66cb-a51c-359b-5a2872169266
 */

const SECTION_ID_FILES = '76c22773-66cb-a51c-359b-5a2872169266';

import { generateUUID, encodeData, apiClient, UPLOAD_URL, getCurrentUserId } from './core/apiClient';
import { createMissingUploadUrlError, createUploadHttpError, getUploadErrorMessage } from './core/uploadErrors';

/**
 * 构建 multipart/form-data 请求体（含文件）
 */
function buildFileFormData(file: File, extraFields: Record<string, string>): FormData {
  const formData = new FormData();
  formData.append('imgFile', file, file.name);
  for (const [key, value] of Object.entries(extraFields)) {
    formData.append(key, value);
  }
  return formData;
}

// ============================================================
// 步骤1：上传文件本体到 upload_json.ashx，获取公网 URL
// ============================================================

export interface UploadFileResult {
  url: string;
  originalName: string;
  success: boolean;
  error?: string;
}

/**
 * 上传单个文件到 upload_json.ashx，返回公网 URL
 */
async function uploadSingleFile(file: File): Promise<UploadFileResult> {
  try {
    const formData = buildFileFormData(file, {});

    const response = await fetch(UPLOAD_URL, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });

    if (!response.ok) {
      throw createUploadHttpError(response, file);
    }

    const result = await response.json();

    // upload_json.ashx 通常返回格式：{ code: 0, msg: "", url: "..." } 或类似
    const url = result.url || result.data?.url || result.path || result.data?.path || '';
    
    if (!url) {
      throw createMissingUploadUrlError();
    }

    return {
      url,
      originalName: file.name,
      success: true,
    };
  } catch (error: any) {
    return {
      url: '',
      originalName: file.name,
      success: false,
      error: getUploadErrorMessage(error),
    };
  }
}

/**
 * 上传多个文件，全部成功才算成功
 */
async function uploadMultipleFiles(files: File[]): Promise<UploadFileResult[]> {
  return Promise.all(files.map(file => uploadSingleFile(file)));
}

// ============================================================
// 步骤2：将文件元数据（含 URL）写入后端区块
// ============================================================

/**
 * 文件上传信息接口
 * 对应后端区块的字段定义（共15个字段）
 */
export interface FileUploadRecord {
  WJMC: string;        // 文件名称 - nvarchar(500) 必填
  WJLX: string;        // 文件类型 - nvarchar(50) 必填
  WJDX: number;        // 文件大小(Bytes) - bigint 必填
  GXRQ: string;        // 更新时间 - datetime 必填
  BZ: string;          // 备注 - nvarchar(-1) 必填
  Url: string;         // 文件地址 - nvarchar(200) 必填 ★ 新增
  sys_user: string;    // sys_user - nvarchar(300) 必填
  sys_muser: string;   // sys_muser - nvarchar(50) 必填
  sys_valid: number;   // sys_valid - smallint 必填
  sys_batchid: string; // sys_batchid - uniqueidentifier 必填
  sys_epsid: string;   // sys_epsid - uniqueidentifier 必填
  XuHao: string;       // XuHao - nvarchar(50) 必填
  [key: string]: any;
}

/**
 * 将前端 FileItem 转换为后端记录格式
 */
function toFileUploadRecord(
  file: { name: string; type: string; size: number; updatedAt: string; attributes: Record<string, string[]> },
  index: number,
  fileUrl: string
): FileUploadRecord {
  const attrText = Object.entries(file.attributes)
    .filter(([, values]) => values.length > 0)
    .map(([dim, values]) => `${dim}: ${values.join(', ')}`)
    .join('; ');
  const currentUserId = getCurrentUserId(undefined, 'uploader');

  return {
    WJMC: file.name,
    WJLX: file.type.toUpperCase(),
    WJDX: file.size,
    GXRQ: new Date(file.updatedAt).toISOString(),
    BZ: attrText || '前端上传',
    Url: fileUrl,
    XuHao: String(index + 1),
    sys_user: currentUserId,
    sys_muser: currentUserId,
    sys_valid: 1,
    sys_batchid: generateUUID(),
    sys_epsid: generateUUID(),
  };
}



/**
 * 将带 URL 的文件记录插入 Jetop 后端
 */
async function insertFileRecordsToBackend(
  records: { file: { id?: string; name: string; type: string; size: number; updatedAt: string; attributes: Record<string, string[]> }; url: string }[]
): Promise<{ success: boolean; message: string; count: number }> {
  try {
    if (records.length === 0) {
      return { success: false, message: '没有记录需要同步', count: 0 };
    }

    const insertedRecords = records.map((rec, index) => {
      const record = toFileUploadRecord(rec.file, index, rec.url);
      record.sys_id = rec.file.id || generateUUID();
      return record;
    });

    const encodedData = encodeData({ updated: insertedRecords });

    const result = await apiClient({
      id: SECTION_ID_FILES,
      mode: 'update',
      _p_data: encodedData,
    });

    if (result.STATUS === 'Success' || result.STATUS === 'OK') {
      return {
        success: true,
        message: `成功同步 ${records.length} 个文件信息到后端`,
        count: records.length,
      };
    } else {
      return {
        success: false,
        message: result.MSG || result.MESSAGE || '后端同步失败',
        count: 0,
      };
    }
  } catch (error: any) {
    console.error('同步文件信息到 Jetop 后端失败:', error);
    return {
      success: false,
      message: `后端同步异常: ${error.message || '未知错误'}`,
      count: 0,
    };
  }
}

// ============================================================
// 对外暴露的完整上传函数
// ============================================================

export interface UploadResult {
  success: boolean;
  message: string;
  fileResults: {
    fileName: string;
    url: string;
    uploadSuccess: boolean;
    saveSuccess: boolean;
  }[];
}

/**
 * 完整文件上传流程：
 *   1. 上传文件本体 → 获取公网 URL
 *   2. 将文件元数据 + URL 写入后端区块
 * 
 * @param browserFiles - 浏览器 File 对象数组（用于上传文件本体）
 * @param fileMetas - 对应的 FileItem 元数据数组（用于保存到后端表）
 * @returns 上传结果
 */
export async function uploadFilesWithBackendSync(
  browserFiles: File[],
  fileMetas: { id?: string; name: string; type: string; size: number; updatedAt: string; attributes: Record<string, string[]> }[]
): Promise<UploadResult> {
  // 步骤1：上传文件到 upload_json.ashx
  // console.log('📤 步骤1: 上传文件到服务器...');
  const uploadResults = await uploadMultipleFiles(browserFiles);

  const failedUploads = uploadResults.filter(r => !r.success);
  if (failedUploads.length > 0) {
    const errorMsg = failedUploads.map(r => `${r.originalName}: ${r.error}`).join('; ');
    return {
      success: false,
      message: `部分文件上传失败: ${errorMsg}`,
      fileResults: uploadResults.map(r => ({
        fileName: r.originalName,
        url: r.url,
        uploadSuccess: r.success,
        saveSuccess: false,
      })),
    };
  }

  // 步骤2：保存元数据到后端区块
  // console.log('📤 步骤2: 保存文件元数据到后端...');
  const records = fileMetas.map((meta, index) => ({
    file: meta,
    url: uploadResults[index].url,
  }));

  const saveResult = await insertFileRecordsToBackend(records);

  return {
    success: saveResult.success,
    message: saveResult.success
      ? `✅ 全部完成: ${saveResult.count} 个文件已上传并同步到后端`
      : `⚠️ 文件已上传但元数据保存失败: ${saveResult.message}`,
    fileResults: uploadResults.map((r) => ({
      fileName: r.originalName,
      url: r.url,
      uploadSuccess: r.success,
      saveSuccess: saveResult.success,
    })),
  };
}

/**
 * 测试与 Jetop 后端的连接
 */
export async function testBackendConnection(): Promise<boolean> {
  try {
    const result = await apiClient({
      id: SECTION_ID_FILES,
      mode: 'query',
      _pageindex: '1',
      _pagesize: '1',
    });
    return result.STATUS === 'Success' || result.STATUS === 'OK';
  } catch {
    return false;
  }
}
