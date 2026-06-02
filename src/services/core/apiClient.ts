const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV;

export const API_HANDLER_URL = isDev ? '/ks/sectionHandler.ashx' : '/jetopcms/ks/sectionHandler.ashx';
export const UPLOAD_URL = isDev ? '/ks/editor/upload_json.ashx?dir=file' : '/jetopcms/ks/editor/upload_json.ashx?dir=file';

// 公司内部 Jetop SSO 登录入口（携带 returnUrl，登录后能跳回当前页）
export const JETOP_SSO_LOGIN_URL =
  'https://test1.tepc.cn/jetopcms/ks/protalpage_layui.aspx?id=137c1dbc-58b3-ddb0-0340-a029a324457d';

/**
 * 静态调试 Token：仅本地开发（npm run dev）使用
 * ⚠️ 生产环境绝不能注入 VITE_AUTH_TOKEN，否则后端 X-JetopDebug-User 会
 *    旁路 SSO 校验，页面将永远不会跳转到登录页。
 */
export function getAuthToken(): string {
  if (isDev && typeof import.meta !== 'undefined' && import.meta.env?.VITE_AUTH_TOKEN) {
    return import.meta.env.VITE_AUTH_TOKEN as string;
  }
  return '';
}

export function isHtmlLoginResponse(text: string): boolean {
  if (!text) return false;
  return (
    text.includes('<!DOCTYPE html>') ||
    text.includes('<html') ||
    text.includes('protalpage_layui') ||
    text.includes('login')
  );
}

export function isUnauthorizedTextResponse(text: string): boolean {
  if (!text) return false;
  const normalized = text.trim().toLowerCase();
  return (
    normalized.includes('not provide token error') ||
    normalized.includes('provide token error') ||
    normalized.includes('token error') ||
    normalized.includes('not logged in') ||
    normalized.includes('unauthorized') ||
    normalized.includes('forbidden')
  );
}

/**
 * 把当前页面 returnUrl 拼到 SSO 登录页，登录完成后回到原页面
 */
export function buildLoginRedirectUrl(currentHref?: string): string {
  const here = currentHref ?? (typeof window !== 'undefined' ? window.location.href : '');
  if (!here) return JETOP_SSO_LOGIN_URL;
  const sep = JETOP_SSO_LOGIN_URL.includes('?') ? '&' : '?';
  return `${JETOP_SSO_LOGIN_URL}${sep}returnUrl=${encodeURIComponent(here)}`;
}

/**
 * 主动重定向到 SSO 登录页（带 returnUrl）
 */
export function redirectToLogin(): void {
  if (typeof window === 'undefined') return;
  const target = buildLoginRedirectUrl();
  // 用 replace 避免在浏览器历史里留下未授权访问的痕迹
  window.location.replace(target);
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

async function handleUnauthorizedResponse(rawText: string, reason: string): Promise<never> {
  console.warn(`[API] ${reason}，跳转 SSO 登录...`, rawText);
  redirectToLogin();
  return new Promise(() => {});
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

  const headers: Record<string, string> = {
    'Content-Type': `multipart/form-data; boundary=${boundary}`,
  };
  // 仅在 dev 静态 token 存在时附加 X-JetopDebug-User
  if (token) {
    headers['X-JetopDebug-User'] = token;
  }

  const response = await fetch(API_HANDLER_URL, {
    method: 'POST',
    headers,
    // 重要：必须带上 credentials，让浏览器把 SSO Cookie 转发到 Jetop 后端
    credentials: 'include',
    body,
  });

  // 1. 检查是否重定向（如果 session 缺失或过期，API 通常会被重定向至登录页）
  if (response.redirected) {
    console.warn('[API] 检测到登录重定向，正在跳转到登录页面:', response.url);
    redirectToLogin();
    return new Promise(() => {}); // 返回未决定的 Promise 阻止后续逻辑执行报错
  }

  if (!response.ok) {
    // 401 / 403 一律视为未登录，跳转 SSO
    if (response.status === 401 || response.status === 403) {
      console.warn('[API] 未授权访问 (HTTP ' + response.status + ')，跳转登录');
      redirectToLogin();
      return new Promise(() => {});
    }
    throw new Error(`HTTP错误: ${response.status} ${response.statusText}`);
  }

  const text = await response.text();

  // 2. 检查返回内容是否为 HTML，若是 HTML 则可能是未登录时被拦截返回的登录/网关页面
  if (isHtmlLoginResponse(text)) {
    return handleUnauthorizedResponse(text, '检测到响应内容为 HTML（疑似登录页）');
  }

  // 3. Jetop 某些未登录场景不会返回 302 / 401 / HTML，而是直接回纯文本错误
  if (isUnauthorizedTextResponse(text)) {
    return handleUnauthorizedResponse(text, '检测到未登录文本响应');
  }

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

/**
 * 主动校验当前会话是否有效
 * - 用于 AuthGuard 启动时检查
 * - 返回 true：会话有效
 * - 返回 false：未登录 / 会话过期
 *   （注：检测到未登录时函数内部会直接跳转 SSO，不会再返回）
 */
export async function checkSession(): Promise<boolean> {
  try {
    await apiClient({
      id: '383be00c-b492-3ce0-373a-43b6a3bedaad',
      mode: 'query',
      _pageindex: '1',
      _pagesize: '1',
    });
    return true;
  } catch (err) {
    console.warn('[checkSession] 会话检查失败，视为未登录:', err);
    redirectToLogin();
    return false;
  }
}
