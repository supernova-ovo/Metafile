import { CheckCircle2, AlertCircle, X } from 'lucide-react';
import { cn } from '../lib/utils';

interface StatusToastProps {
  title: string;
  message: string;
  tone: 'success' | 'error';
  onClose: () => void;
}

export function StatusToast({ title, message, tone, onClose }: StatusToastProps) {
  const isSuccess = tone === 'success';

  return (
    <div
      className={cn(
        'pointer-events-auto flex w-[360px] max-w-[calc(100vw-2rem)] items-start gap-3 rounded-2xl border p-4 shadow-xl backdrop-blur-sm',
        isSuccess
          ? 'border-emerald-200 bg-white/95'
          : 'border-amber-200 bg-white/95'
      )}
    >
      <div
        className={cn(
          'mt-0.5 rounded-full p-2',
          isSuccess ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
        )}
      >
        {isSuccess ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-gray-900">{title}</p>
        <p className="mt-1 text-sm leading-5 text-gray-600">{message}</p>
      </div>

      <button
        onClick={onClose}
        className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
