export const API_HANDLER_URL = '/ks/sectionHandler.ashx';
export const UPLOAD_URL = '/ks/editor/upload_json.ashx?dir=file';

export function getAuthToken(): string {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_AUTH_TOKEN) {
    return import.meta.env.VITE_AUTH_TOKEN as string;
  }
  return '';
}

export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16).toUpperCase();
  });
}

export function buildFormData(fields: Record<string, string>): { boundary: string; body: string } {
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

export function encodeData(obj: any): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(obj))));
}

export async function apiClient(formFields: Record<string, string>): Promise<any> {
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
    throw new Error(`后端写入失败: ${status || 'UNKNOWN'} ${parsed?.MSG || parsed?.MESSAGE || ''}`.trim());
  }
  
  return parsed;
}
