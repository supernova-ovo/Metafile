import { useState } from 'react';
import { X, UploadCloud, Tag } from 'lucide-react';
import type { FileItem } from '../lib/types';
import { availableDimensions } from '../lib/mock-data';

interface UploadModalProps {
  files: FileItem[];
  onConfirm: (files: FileItem[]) => void;
  onCancel: () => void;
  dimensionOrder: string[];
}

export function UploadModal({ files, onConfirm, onCancel, dimensionOrder }: UploadModalProps) {
  const [stagedFiles, setStagedFiles] = useState<FileItem[]>(files);
  const [batchDim, setBatchDim] = useState(dimensionOrder[0] || '部门');
  const [batchVal, setBatchVal] = useState('');

  const handleApplyBatchTag = () => {
    if (!batchVal.trim()) return;
    setStagedFiles(prev => prev.map(f => {
      const updatedAttrs = { ...f.attributes };
      if (!updatedAttrs[batchDim]) updatedAttrs[batchDim] = [];
      if (!updatedAttrs[batchDim].includes(batchVal.trim())) {
        updatedAttrs[batchDim].push(batchVal.trim());
      }
      return { ...f, attributes: updatedAttrs };
    }));
    setBatchVal('');
  };

  const handleRemoveTag = (fileId: string, dim: string, val: string) => {
    setStagedFiles(prev => prev.map(f => {
      if (f.id !== fileId) return f;
      const updatedAttrs = { ...f.attributes };
      if (updatedAttrs[dim]) {
        updatedAttrs[dim] = updatedAttrs[dim].filter(v => v !== val);
      }
      return { ...f, attributes: updatedAttrs };
    }));
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-[600px] max-h-[80vh] flex flex-col overflow-hidden">
        <div className="p-4 border-b border-border flex justify-between items-center bg-[#FBFBFA]">
          <h2 className="font-semibold flex items-center gap-2">
            <UploadCloud className="w-5 h-5 text-indigo-500" />
            上传解析 ({stagedFiles.length} 个文件)
          </h2>
          <button onClick={onCancel} className="p-1 hover:bg-gray-200 rounded-md transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-4 border-b border-border bg-indigo-50/50">
          <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2 flex items-center gap-2">
            <Tag className="w-4 h-4" />
            批量打标签 (应用到所有上传文件)
          </h3>
          <div className="flex gap-2 text-sm">
            <select 
              value={batchDim} 
              onChange={e => setBatchDim(e.target.value)}
              className="border border-border rounded px-2 py-1 outline-none bg-white"
            >
              {availableDimensions.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <input 
              type="text" 
              value={batchVal}
              onChange={e => setBatchVal(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleApplyBatchTag()}
              placeholder="输入标签值回车..."
              className="flex-1 border border-border rounded px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <button 
              onClick={handleApplyBatchTag}
              className="bg-indigo-600 text-white px-4 py-1.5 rounded hover:bg-indigo-700 transition-colors shadow-sm"
            >
              应用
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {stagedFiles.map(file => (
            <div key={file.id} className="border border-border rounded-lg p-3 shadow-sm hover:border-indigo-200 transition-colors">
              <div className="font-medium text-sm mb-2 truncate" title={file.name}>{file.name}</div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(file.attributes).map(([dim, vals]) => 
                  vals.map(val => (
                    <div key={`${dim}-${val}`} className="flex items-center gap-1 bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-xs border border-indigo-100">
                      <span className="text-indigo-400 mr-0.5 font-medium">{dim}:</span>
                      <span>{val}</span>
                      <button 
                        onClick={() => handleRemoveTag(file.id, dim, val)}
                        className="hover:text-red-500 hover:bg-indigo-100 rounded-full cursor-pointer ml-1 p-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))
                )}
                {Object.keys(file.attributes).length === 0 && (
                  <span className="text-xs text-amber-500 italic bg-amber-50 px-2 py-0.5 rounded border border-amber-200">待分类 (将进入 Inbox)</span>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-border flex justify-end gap-3 bg-[#FBFBFA]">
          <button onClick={onCancel} className="px-5 py-2 border border-border rounded-md hover:bg-gray-100 transition-colors text-sm font-medium text-text-secondary">
            取消
          </button>
          <button 
            onClick={() => onConfirm(stagedFiles)} 
            className="px-5 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors text-sm font-medium shadow-sm"
          >
            确认上传
          </button>
        </div>
      </div>
    </div>
  );
}
