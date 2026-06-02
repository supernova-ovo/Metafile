import { useEffect, useState, type ReactNode } from 'react';
import { Loader2, ShieldAlert } from 'lucide-react';
import { checkSession } from '../services/core/apiClient';

interface AuthGuardProps {
  children: ReactNode;
}

/**
 * 应用启动守卫：渲染 children 之前先调用 checkSession 校验 SSO 会话。
 *  - 会话有效 → 正常渲染 children
 *  - 会话失效 → checkSession 内部会主动跳转 SSO 登录页
 *                此处展示"校验中 / 未授权"过渡 UI，避免主界面闪烁
 */
export function AuthGuard({ children }: AuthGuardProps) {
  const [status, setStatus] = useState<'checking' | 'ok' | 'failed'>('checking');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const ok = await checkSession();
        if (cancelled) return;
        if (ok) {
          setStatus('ok');
        } else {
          setStatus('failed');
        }
      } catch (e: any) {
        if (cancelled) return;
        // checkSession 内部已经会跳转登录页，这里只在极端网络错误时给出提示
        setErrorMsg(e?.message || '会话校验失败');
        setStatus('failed');
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, []);

  if (status === 'ok') return <>{children}</>;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#FBFBFA] font-sans">
      <div className="flex flex-col items-center gap-4 text-center px-6">
        {status === 'checking' ? (
          <>
            <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
            <div>
              <h2 className="text-base font-semibold text-gray-800">正在校验登录状态…</h2>
              <p className="text-xs text-gray-500 mt-1">首次访问会自动跳转到公司统一登录入口</p>
            </div>
          </>
        ) : (
          <>
            <ShieldAlert className="w-10 h-10 text-amber-500" />
            <div>
              <h2 className="text-base font-semibold text-gray-800">未登录或会话已过期</h2>
              <p className="text-xs text-gray-500 mt-1">
                {errorMsg || '正在跳转到 Jetop 统一登录页…'}
              </p>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors"
              >
                重新校验
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default AuthGuard;
