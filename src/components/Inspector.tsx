import { useState, Fragment } from 'react';
import { X, Plus, Network, Hash, FileText } from 'lucide-react';
import type { FileItem } from '../lib/types';
import { availableDimensions } from '../lib/mock-data';
import { findPathsForFile } from '../lib/tree';

interface InspectorProps {
  selectedFile: FileItem | undefined;
  allFiles: FileItem[];
  dimensionOrder: string[];
  onUpdateAttributes: (id: string, newAttrs: Record<string, string[]>) => void;
  onClose: () => void;
}

export function Inspector({ selectedFile, allFiles, dimensionOrder, onUpdateAttributes, onClose }: InspectorProps) {
  const [newTagInput, setNewTagInput] = useState<{ dim: string; val: string }>({ dim: '', val: '' });

  if (!selectedFile) {
    return (
      <div className="w-80 border-l border-border bg-[#FBFBFA] p-6 flex flex-col items-center justify-center text-text-secondary h-full text-sm">
        <div className="w-20 h-20 bg-gray-50 rounded-full flex justify-center items-center mb-5 border border-gray-100 shadow-[inset_0_2px_10px_rgba(0,0,0,0.02)]">
          <FileText className="w-8 h-8 text-gray-300" />
        </div>
        <h3 className="text-gray-600 font-semibold mb-1 text-base tracking-tight">属性详情</h3>
        <p className="text-gray-400 text-xs text-center leading-relaxed mt-1">选中一个文件查看属性</p>
      </div>
    );
  }

  const handleRemoveTag = (dim: string, val: string) => {
    const updatedAttrs = { ...selectedFile.attributes };
    if (updatedAttrs[dim]) {
      updatedAttrs[dim] = updatedAttrs[dim].filter(v => v !== val);
      if (updatedAttrs[dim].length === 0) {
        delete updatedAttrs[dim];
      }
    }
    onUpdateAttributes(selectedFile.id, updatedAttrs);
  };

  const handleAddTag = (dim: string, forceVal?: string) => {
    const valToAdd = (forceVal !== undefined ? forceVal : newTagInput.val).trim();
    if (!valToAdd) {
      setNewTagInput({ dim: '', val: '' });
      return;
    }
    const updatedAttrs = { ...selectedFile.attributes };
    if (!updatedAttrs[dim]) {
      updatedAttrs[dim] = [];
    }
    if (!updatedAttrs[dim].includes(valToAdd)) {
      updatedAttrs[dim].push(valToAdd);
    }
    onUpdateAttributes(selectedFile.id, updatedAttrs);
    setNewTagInput({ dim: '', val: '' });
  };

  const getExistingTags = (dim: string) => {
    const tags = new Set<string>();
    allFiles.forEach(file => {
      (file.attributes[dim] || []).forEach(val => tags.add(val));
    });
    return Array.from(tags);
  };

  const virtualPaths = findPathsForFile(allFiles, dimensionOrder, selectedFile.id);

  return (
    <div className="w-80 border-l border-border bg-[#FBFBFA] flex flex-col h-full overflow-y-auto text-sm">
      <div className="p-6 border-b border-border bg-white">
        <div className="flex justify-between items-start mb-1 gap-2">
          <h2 className="font-semibold text-base truncate flex-1 leading-tight" title={selectedFile.name}>{selectedFile.name}</h2>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-800 hover:bg-gray-100 p-1.5 -mr-1.5 -mt-1 rounded-md transition-colors"
            title="关闭属性面板"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="text-xs text-text-secondary flex gap-2">
          <span>{selectedFile.type.toUpperCase()}</span>
          <span>•</span>
          <span>{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</span>
        </div>
      </div>

      <div className="p-6">
        <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-4 flex items-center gap-2">
          <Hash className="w-4 h-4" />
          属性标签
        </h3>
        
        <div className="space-y-4">
          {availableDimensions.map(dim => {
            const values = selectedFile.attributes[dim] || [];
            const isAdding = newTagInput.dim === dim;
            
            const existingTags = isAdding ? getExistingTags(dim) : [];
            const filteredTags = existingTags.filter(t => 
              t.toLowerCase().includes(newTagInput.val.toLowerCase()) && 
              !values.includes(t)
            );
            
            return (
              <div key={dim} className="bg-white border border-border p-3 rounded-lg shadow-sm">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-text-secondary font-medium">{dim}</span>
                  {!isAdding && (
                    <button 
                      onClick={() => setNewTagInput({ dim, val: '' })}
                      className="text-gray-400 hover:text-indigo-600 transition-colors bg-accent rounded p-0.5"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  )}
                </div>
                
                <div className="flex flex-wrap gap-2 relative">
                  {values.map(val => (
                    <div key={val} className="flex items-center gap-1 bg-indigo-50 text-indigo-700 px-2 py-1 rounded text-xs border border-indigo-100 shadow-sm">
                      <span>{val}</span>
                      <button 
                        onClick={() => handleRemoveTag(dim, val)}
                        className="hover:text-red-500 hover:bg-indigo-100 rounded-full cursor-pointer ml-1 p-0.5 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  
                  {isAdding && (
                    <div className="relative w-full mt-1">
                      <input 
                        autoFocus
                        type="text" 
                        value={newTagInput.val}
                        onChange={(e) => setNewTagInput({ dim, val: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAddTag(dim, newTagInput.val);
                          if (e.key === 'Escape') setNewTagInput({ dim: '', val: '' });
                        }}
                        onBlur={() => {
                          // Allow mousedown to fire on dropdown options before blur closes input
                          setTimeout(() => handleAddTag(dim, newTagInput.val), 150);
                        }}
                        className="flex-1 border border-indigo-300 rounded text-xs px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-500 w-full"
                        placeholder={`搜索或添加${dim}...`}
                      />
                      
                      {filteredTags.length > 0 && (
                        <div className="absolute top-full left-0 w-full mt-1 bg-white border border-border shadow-lg rounded-md max-h-40 overflow-y-auto z-10">
                          {filteredTags.map(tag => (
                            <div 
                              key={tag}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                handleAddTag(dim, tag);
                              }}
                              className="px-3 py-2 text-xs hover:bg-indigo-50 cursor-pointer text-primary transition-colors"
                            >
                              {tag}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {values.length === 0 && !isAdding && (
                    <span className="text-xs text-gray-300 italic">空</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="p-6 border-t border-border mt-auto">
        <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-4 flex items-center gap-2">
          <Network className="w-4 h-4 text-indigo-500" />
          当前视图下的虚拟映射
        </h3>
        {virtualPaths.length > 0 ? (
          <div className="space-y-2">
            {virtualPaths.map((path, idx) => (
              <div key={idx} className="bg-white border border-border rounded-md px-3 py-2 text-xs text-text-secondary flex gap-1 overflow-x-auto whitespace-nowrap scrollbar-hide flex-wrap">
                {path.length === 0 ? <span className="text-gray-400 italic">根目录</span> : null}
                {path.map((segment, i) => (
                  <Fragment key={i}>
                    <span className="text-primary font-medium">{segment}</span>
                    {i < path.length - 1 && <span className="text-gray-400">/</span>}
                  </Fragment>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-gray-400 italic">
            由于维度的值缺少，文件在当前视图不可见
          </div>
        )}
      </div>
    </div>
  );
}
