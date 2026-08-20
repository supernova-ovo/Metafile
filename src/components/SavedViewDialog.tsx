import { Bookmark, Loader2, MapPin, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { SavedView } from '../lib/types';
import { MAX_SAVED_VIEW_NAME_LENGTH } from '../lib/savedViews';

interface SavedViewDialogProps {
  title: string;
  view: SavedView | null;
  currentPath: string[];
  currentDimensionOrder: string[];
  onCancel: () => void;
  onSubmit: (input: { name: string; replaceTarget: boolean }) => Promise<void> | void;
}

const pathLabel = (path: string[]) => path.length > 0 ? path.join(' / ') : '全部文件';

export function SavedViewDialog({
  title,
  view,
  currentPath,
  currentDimensionOrder,
  onCancel,
  onSubmit,
}: SavedViewDialogProps) {
  const [name, setName] = useState('');
  const [replaceTarget, setReplaceTarget] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setName(view?.name || '');
    setReplaceTarget(!view);
  }, [view]);

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onSubmit({ name: trimmed, replaceTarget });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onMouseDown={() => !isSubmitting && onCancel()}>
      <div className="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border bg-[#FBFBFA] p-4">
          <h2 className="flex items-center gap-2 font-semibold text-gray-900">
            <Bookmark className="h-4 w-4 text-indigo-500" />
            {title}
          </h2>
          <button onClick={onCancel} disabled={isSubmitting} className="rounded-md p-1 transition-colors hover:bg-gray-200 disabled:opacity-50" aria-label="关闭">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">名称</label>
            <input
              autoFocus
              maxLength={MAX_SAVED_VIEW_NAME_LENGTH}
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && void handleSubmit()}
              placeholder="例如：2026 年董事会资料"
              disabled={isSubmitting}
              className="w-full rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50"
            />
          </div>

          {view && (
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-indigo-100 bg-indigo-50/50 p-3 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={replaceTarget}
                onChange={(event) => setReplaceTarget(event.target.checked)}
                disabled={isSubmitting}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>
                <span className="block font-medium text-gray-900">同步为当前浏览位置</span>
                <span className="mt-0.5 block text-xs text-gray-500">不勾选时仅修改名称，原目标路径保持不变。</span>
              </span>
            </label>
          )}

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
            <div className="mb-1 flex items-center gap-1.5 font-medium text-gray-700">
              <MapPin className="h-4 w-4 text-indigo-500" />
              {view && !replaceTarget ? '已保存目标' : '当前将保存的目标'}
            </div>
            <p className="break-all text-gray-600">{pathLabel(view && !replaceTarget ? view.currentPath : currentPath)}</p>
            <p className="mt-2 break-all text-xs text-gray-400">
              维度顺序：{(view && !replaceTarget ? view.dimensionOrder : currentDimensionOrder).join(' / ') || '未设置'}
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-border bg-[#FBFBFA] p-4">
          <button onClick={onCancel} disabled={isSubmitting} className="rounded-md border border-border px-5 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-gray-100 disabled:opacity-50">
            取消
          </button>
          <button onClick={() => void handleSubmit()} disabled={isSubmitting || !name.trim()} className="inline-flex min-w-20 items-center justify-center gap-2 rounded-md bg-indigo-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50">
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
