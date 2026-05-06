import { AlertTriangle, Loader2, Trash2, X } from 'lucide-react';
import type { FileItem } from '../lib/types';

interface DeleteFileModalProps {
  file: FileItem;
  isDeleting: boolean;
  errorMessage: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeleteFileModal({
  file,
  isDeleting,
  errorMessage,
  onCancel,
  onConfirm,
}: DeleteFileModalProps) {
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-[520px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-border bg-[#FBFBFA] p-4">
          <div className="flex items-center gap-2">
            <div className="rounded-full bg-red-100 p-2 text-red-600">
              <Trash2 className="h-4 w-4" />
            </div>
            <h2 className="font-semibold text-gray-900">删除文件</h2>
          </div>
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="rounded-md p-1 transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="rounded-lg border border-red-100 bg-red-50 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
              <div>
                <p className="text-sm font-medium text-gray-900">确定要删除这个文件吗？</p>
                <p className="mt-1 break-all text-sm text-gray-600">{file.name}</p>
                <p className="mt-2 text-xs text-gray-500">删除后会同步移除后端文件记录和对应的标签关联，操作后不可恢复。</p>
              </div>
            </div>
          </div>

          {errorMessage && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {errorMessage}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-border bg-[#FBFBFA] p-4">
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="rounded-md border border-border px-5 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex min-w-[112px] items-center justify-center gap-2 rounded-md bg-red-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-400"
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                删除中...
              </>
            ) : (
              '确认删除'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
