import { useEffect, useState } from 'react';
import { X, ExternalLink, Loader2, AlertCircle } from 'lucide-react';
import { useFileStore } from '../../store/useFileStore';

interface PreviewModalProps {
  fileId: string;
  onClose: () => void;
}

export function PreviewModal({ fileId, onClose }: PreviewModalProps) {
  const file = useFileStore(state => state.files[fileId]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBlocked, setIsBlocked] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file?.url) return;

    const PREVIEW_SUPPORTED_TYPES = ['pdf', 'docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt'];
    let targetUrl = file.url;

    if (PREVIEW_SUPPORTED_TYPES.includes(file.type.toLowerCase())) {
      try {
        const baseUrl = window.location.origin;
        const fullUrl = file.url.startsWith('http') ? file.url : `${baseUrl}${file.url}`;
        const base64Url = btoa(unescape(encodeURIComponent(fullUrl)));
        targetUrl = `https://lolkdoc.tepc.cn/onlinePreview?url=${base64Url}`;
      } catch (e) {
        console.error('Failed to generate preview URL', e);
      }
    }

    setPreviewUrl(targetUrl);

    let isMounted = true;

    // Check if the URL allows iframe embedding
    const checkIframeAbility = async () => {
      try {
        const response = await fetch(targetUrl, { method: 'HEAD' });
        const xFrameOptions = response.headers.get('x-frame-options');
        const csp = response.headers.get('content-security-policy');

        if (!isMounted) return;

        if (xFrameOptions && xFrameOptions.toUpperCase() === 'DENY') {
          setIsBlocked(true);
        } else if (csp && csp.toLowerCase().includes("frame-ancestors 'none'")) {
          setIsBlocked(true);
        }
      } catch (error) {
        // If fetch fails (e.g. CORS), we can't reliably read headers.
        // We'll optimistically try to load the iframe anyway, 
        // as some servers don't set CORS but allow iframe.
        console.warn('Could not pre-check iframe headers due to CORS or network error.', error);
      }
    };

    checkIframeAbility();

    return () => {
      isMounted = false;
    };
  }, [file?.url, file?.type]);

  if (!file) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="absolute inset-0" 
        onClick={onClose}
      />
      <div className="relative w-11/12 max-w-5xl h-[85vh] bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50/80 backdrop-blur-md z-10 shrink-0">
          <div className="flex items-center gap-3 truncate">
            <h2 className="text-sm font-semibold text-gray-800 truncate" title={file.name}>
              {file.name}
            </h2>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {previewUrl && (
              <a
                href={previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                新窗口打开
              </a>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-200 rounded-md transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="relative flex-1 bg-gray-100 flex items-center justify-center">
          {!file.url ? (
            <div className="flex flex-col items-center justify-center text-gray-500">
              <AlertCircle className="w-12 h-12 mb-3 text-gray-400" />
              <p>该文件没有预览链接</p>
            </div>
          ) : isBlocked ? (
            <div className="flex flex-col items-center justify-center text-gray-600 bg-white p-8 rounded-xl shadow-sm border border-gray-200 max-w-md text-center">
              <ExternalLink className="w-16 h-16 mb-4 text-indigo-400" />
              <h3 className="text-lg font-bold text-gray-800 mb-2">当前系统不支持内嵌预览</h3>
              <p className="text-sm text-gray-500 mb-6 leading-relaxed">
                受目标服务器安全策略限制，此内容无法在内部窗口直接显示，请在新窗口中打开查看。
              </p>
              <a
                href={previewUrl!}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors shadow-sm"
              >
                <ExternalLink className="w-4 h-4" />
                在新窗口打开
              </a>
            </div>
          ) : (
            <>
              {isLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 z-10">
                  <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-3" />
                  <p className="text-sm text-gray-500 font-medium">正在加载预览...</p>
                </div>
              )}
              <iframe
                src={previewUrl!}
                title={`Preview of ${file.name}`}
                className={`w-full h-full border-none transition-opacity duration-300 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
                onLoad={() => setIsLoading(false)}
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
