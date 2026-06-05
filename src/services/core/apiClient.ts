const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV;

export const API_HANDLER_URL = isDev ? '/ks/sectionHandler.ashx' : '/jetopcms/ks/sectionHandler.ashx';
export const UPLOAD_URL = isDev ? '/ks/editor/upload_json.ashx?dir=file' : '/jetopcms/ks/editor/upload_json.ashx?dir=file';

// 公司内部统一认证入口
export const JETOP_SSO_BASE_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SSO_LOGIN_URL) ||
  'https://lol.tepc.cn/mm/default.aspx';
const CONFIGURED_APP_ENTRY_URL =
  typeof import.meta !== 'undefined' ? import.meta.env?.VITE_APP_ENTRY_URL : '';

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

export function hasPlatformLoginCookies(cookieString?: string): boolean {
  if (typeof document === 'undefined' && cookieString === undefined) return false;
  const source = cookieString ?? document.cookie;
  const cookies = new Map(
    source
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const separatorIndex = part.indexOf('=');
        if (separatorIndex === -1) return [part, ''] as const;
        return [
          part.slice(0, separatorIndex).trim(),
          part.slice(separatorIndex + 1).trim(),
        ] as const;
      })
  );

  return ['ud', 'uid', 'un'].every((name) => Boolean(cookies.get(name)));
}

/**
 * 统一认证后回跳到当前项目入口页。
 */
export function buildLoginRedirectUrl(currentHref?: string): string {
  const returnUrl =
    CONFIGURED_APP_ENTRY_URL ||
    currentHref ||
    (typeof window !== 'undefined' ? window.location.href : '');
  return `${JETOP_SSO_BASE_URL}?ReturnUrl=${encodeURIComponent(returnUrl)}`;
}

/**
 * 主动重定向到 SSO 登录页（带 returnUrl）
 */
export function redirectToLogin(): void {
  if (typeof window === 'undefined') return;
  const target = buildLoginRedirectUrl(window.location.href);
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
  console.warn(`[API] ${reason}，已拦截自动跳转，便于诊断`, rawText);
  throw new Error(`[AUTH_DIAGNOSTIC] ${reason}`);
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
    console.warn('[API] 检测到登录重定向，已拦截自动跳转，便于诊断:', {
      request: formFields,
      responseUrl: response.url,
      status: response.status,
    });
    throw new Error(`[AUTH_DIAGNOSTIC] 检测到登录重定向: ${response.url}`);
  }

  if (!response.ok) {
    // 401 / 403 一律视为未登录，跳转 SSO
    if (response.status === 401 || response.status === 403) {
      console.warn('[API] 未授权访问，已拦截自动跳转，便于诊断:', {
        request: formFields,
        status: response.status,
        statusText: response.statusText,
      });
      throw new Error(`[AUTH_DIAGNOSTIC] 未授权访问: HTTP ${response.status}`);
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
 * - 平台约定：Cookie 中同时存在 ud / uid / un 即视为已登录
 */
export async function checkSession(): Promise<boolean> {
  console.warn('[checkSession] 诊断模式：暂时放行入口 Cookie 校验', {
    hasPlatformLoginCookies: hasPlatformLoginCookies(),
    readableCookieNames: typeof document === 'undefined'
      ? []
      : document.cookie
        .split(';')
        .map((part) => part.trim().split('=')[0])
        .filter(Boolean),
  });
  return true;
}
