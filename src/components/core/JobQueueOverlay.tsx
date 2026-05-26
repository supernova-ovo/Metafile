import { useState } from 'react';
import { useJobStore } from '../../store/useJobStore';
import { jobQueue } from '../../services/jobQueue';
import { X, ChevronUp, ChevronDown, CheckCircle, XCircle, Loader2, UploadCloud, RefreshCcw } from 'lucide-react';
import { cn } from '../../lib/utils';

export function JobQueueOverlay() {
  const { jobs, isQueueOpen, setQueueOpen, clearCompleted } = useJobStore();
  const [isMinimized, setIsMinimized] = useState(false);

  const jobList = Object.values(jobs);
  if (jobList.length === 0 && !isQueueOpen) return null;
  if (jobList.length === 0) {
    // Auto close if empty
    setTimeout(() => setQueueOpen(false), 0);
    return null;
  }

  const pendingCount = jobList.filter(j => j.status === 'pending' || j.status === 'uploading' || j.status === 'syncing').length;
  const failedCount = jobList.filter(j => j.status === 'failed').length;
  const successCount = jobList.filter(j => j.status === 'success').length;

  return (
    <div className="fixed bottom-6 right-6 z-[110] w-80 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col transition-all duration-300">
      {/* Header */}
      <div 
        className={cn(
          "px-4 py-3 border-b border-gray-100 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors",
          failedCount > 0 ? "bg-red-50/50" : "bg-white"
        )}
        onClick={() => setIsMinimized(!isMinimized)}
      >
        <div className="flex items-center gap-2">
          {pendingCount > 0 ? (
            <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
          ) : failedCount > 0 ? (
            <XCircle className="w-4 h-4 text-red-500" />
          ) : (
            <CheckCircle className="w-4 h-4 text-green-500" />
          )}
          <span className="font-semibold text-sm text-gray-800">
            {pendingCount > 0 ? `正在上传 (${pendingCount})` : '上传完成'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button 
            className="p-1 hover:bg-gray-200 rounded text-gray-500"
            onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }}
          >
            {isMinimized ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <button 
            className="p-1 hover:bg-gray-200 rounded text-gray-500"
            onClick={(e) => { e.stopPropagation(); setQueueOpen(false); }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Body */}
      {!isMinimized && (
        <div className="max-h-80 overflow-y-auto p-2 bg-gray-50/50">
          {/* Actions */}
          <div className="flex justify-between items-center px-2 py-1 mb-2">
            <span className="text-xs text-gray-500">
              共 {jobList.length} 个任务
            </span>
            <div className="flex gap-2">
              {failedCount > 0 && (
                <button 
                  onClick={() => jobQueue.retryAllFailed()}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
                >
                  <RefreshCcw className="w-3 h-3" /> 全部重试
                </button>
              )}
              {successCount > 0 && (
                <button 
                  onClick={() => clearCompleted()}
                  className="text-xs text-gray-500 hover:text-gray-700 font-medium"
                >
                  清除已完成
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="flex flex-col gap-2">
            {jobList.map(job => (
              <div key={job.id} className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm flex flex-col gap-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2 truncate pr-2">
                    <UploadCloud className="w-4 h-4 text-gray-400 shrink-0" />
                    <span className="text-sm font-medium text-gray-700 truncate" title={job.file.name}>
                      {job.file.name}
                    </span>
                  </div>
                  {job.status === 'pending' && <span className="text-xs text-gray-400 shrink-0">等待中</span>}
                  {job.status === 'uploading' && <span className="text-xs text-indigo-500 shrink-0 font-medium">上传中...</span>}
                  {job.status === 'syncing' && <span className="text-xs text-indigo-500 shrink-0 font-medium">同步中...</span>}
                  {job.status === 'success' && <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />}
                  {job.status === 'failed' && (
                    <button 
                      onClick={() => jobQueue.retryJob(job.id)}
                      className="p-1 hover:bg-gray-100 rounded text-red-500 shrink-0"
                      title="重试"
                    >
                      <RefreshCcw className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                
                {/* Progress Bar */}
                {job.status !== 'success' && job.status !== 'failed' && (
                  <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className="bg-indigo-500 h-1.5 transition-all duration-300" 
                      style={{ width: `${job.progress}%` }}
                    />
                  </div>
                )}
                
                {/* Error message */}
                {job.status === 'failed' && (
                  <div className="text-xs text-red-500 bg-red-50 p-1.5 rounded truncate">
                    {job.error || '上传失败'}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
