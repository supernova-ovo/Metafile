import React, { useState, useMemo } from 'react';
import { ArrowLeft, Edit2, Merge, Trash2, ChevronDown, Plus, Tag, AlertTriangle, Loader2, X } from 'lucide-react';
import type { FileItem } from '../lib/types';
import type { DimRow } from '../services/apiService';
import { ensureDimension, updateDimension, deleteDimensionWithRelations } from '../services/apiService';

interface ManagementProps {
  files: FileItem[];
  setFiles: React.Dispatch<React.SetStateAction<FileItem[]>>;
  onFilesChangeWithoutSync?: (updater: React.SetStateAction<FileItem[]>) => void;
  dimensions: DimRow[];
  setDimensions: React.Dispatch<React.SetStateAction<DimRow[]>>;
  onClose: () => void;
}

export function Management({ files, setFiles, onFilesChangeWithoutSync, dimensions, setDimensions, onClose }: ManagementProps) {
  const [selectedDimension, setSelectedDimension] = useState<string>(dimensions[0]?.WHMC || '');
  const [isExpanded, setIsExpanded] = useState(true);
  const [tagToDelete, setTagToDelete] = useState<string | null>(null);

  const [dimModalConfig, setDimModalConfig] = useState<{ isOpen: boolean; mode: 'create' | 'edit'; dimId?: string; initialName?: string }>({ isOpen: false, mode: 'create' });
  const [dimInput, setDimInput] = useState('');
  const [isDimSubmitting, setIsDimSubmitting] = useState(false);
  const [dimError, setDimError] = useState<string | null>(null);

  const [deleteDimConfig, setDeleteDimConfig] = useState<{ isOpen: boolean; dimId?: string; dimName?: string }>({ isOpen: false });
  const [isDimDeleting, setIsDimDeleting] = useState(false);

  const handleDimSubmit = async () => {
    const newDim = dimInput.trim();
    if (!newDim) return;
    if (dimModalConfig.mode === 'create' && dimensions.find(d => d.WHMC === newDim)) {
      setDimError('该维度已存在！');
      return;
    }
    if (dimModalConfig.mode === 'edit' && newDim === dimModalConfig.initialName) {
      setDimModalConfig({ isOpen: false, mode: 'create' });
      return;
    }
    
    setIsDimSubmitting(true);
    setDimError(null);
    try {
      if (dimModalConfig.mode === 'create') {
        const sys_id = await ensureDimension(newDim);
        const newDimObj: DimRow = { sys_id, WHMC: newDim, WHMS: newDim };
        setDimensions(prev => [...prev, newDimObj]);
        setSelectedDimension(newDim);
      } else if (dimModalConfig.mode === 'edit' && dimModalConfig.dimId) {
        await updateDimension(dimModalConfig.dimId, newDim);
        setDimensions(prev => prev.map(d => d.sys_id === dimModalConfig.dimId ? { ...d, WHMC: newDim, WHMS: newDim } : d));
        
        // Use onFilesChangeWithoutSync so we don't trigger backend saves for all files!
        const filesUpdater = (prev: FileItem[]) => prev.map(f => {
          if (!f.attributes[dimModalConfig.initialName!]) return f;
          const newAttrs = { ...f.attributes };
          newAttrs[newDim] = newAttrs[dimModalConfig.initialName!];
          delete newAttrs[dimModalConfig.initialName!];
          return { ...f, attributes: newAttrs };
        });
        
        if (onFilesChangeWithoutSync) {
          onFilesChangeWithoutSync(filesUpdater);
        } else {
          setFiles(filesUpdater);
        }

        if (selectedDimension === dimModalConfig.initialName) setSelectedDimension(newDim);
      }
      setDimModalConfig({ isOpen: false, mode: 'create' });
    } catch (err: any) {
      setDimError(err.message || '操作失败');
    } finally {
      setIsDimSubmitting(false);
    }
  };

  const handleDimDeleteConfirm = async () => {
    if (!deleteDimConfig.dimId || !deleteDimConfig.dimName) return;
    setIsDimDeleting(true);
    setDimError(null);
    try {
      await deleteDimensionWithRelations(deleteDimConfig.dimId);
      setDimensions(prev => prev.filter(d => d.sys_id !== deleteDimConfig.dimId));
      if (selectedDimension === deleteDimConfig.dimName) setSelectedDimension('');
      
      const filesUpdater = (prev: FileItem[]) => prev.map(f => {
        if (!f.attributes[deleteDimConfig.dimName!]) return f;
        const newAttrs = { ...f.attributes };
        delete newAttrs[deleteDimConfig.dimName!];
        return { ...f, attributes: newAttrs };
      });
      
      if (onFilesChangeWithoutSync) {
        onFilesChangeWithoutSync(filesUpdater);
      } else {
        setFiles(filesUpdater);
      }
      
      setDeleteDimConfig({ isOpen: false });
    } catch (err: any) {
      setDimError(err.message || '删除失败');
    } finally {
      setIsDimDeleting(false);
    }
  };

  // Compute tag statistics for the selected dimension
  const tagStats = useMemo(() => {
    if (!selectedDimension) return [];
    
    const stats: Record<string, number> = {};
    files.forEach(file => {
      const tags = file.attributes[selectedDimension];
      if (tags && tags.length > 0) {
        tags.forEach(tag => {
          stats[tag] = (stats[tag] || 0) + 1;
        });
      }
    });

    return Object.entries(stats)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count); // Sort by usage descending
  }, [files, selectedDimension]);

  React.useEffect(() => {
    if (!selectedDimension && dimensions.length > 0) {
      setSelectedDimension(dimensions[0].WHMC);
    }
  }, [dimensions, selectedDimension]);

  const handleRename = (oldName: string) => {
    const newName = window.prompt(`请为标签「${oldName}」输入新的名称：`, oldName);
    if (!newName || newName.trim() === '' || newName === oldName) return;
    
    const trimmed = newName.trim();
    
    // Tag rename updates the tag on all files. This probably should trigger DB sync since file fingerprints change
    // If the backend has its own logic for renaming tags, we'd call the backend API, then use onFilesChangeWithoutSync.
    // Currently tag rename is purely local? Wait, if we don't have a backend rename tag API yet, it falls back to DB sync.
    setFiles(prev => prev.map(file => {
      const currentTags = file.attributes[selectedDimension];
      if (!currentTags || !currentTags.includes(oldName)) return file;
      
      const newTags = currentTags.map(t => (t === oldName ? trimmed : t));
      // Remove duplicates just in case the new name already existed in this file's tags
      const uniqueTags = Array.from(new Set(newTags));
      
      return {
        ...file,
        attributes: {
          ...file.attributes,
          [selectedDimension]: uniqueTags
        }
      };
    }));
  };

  const handleMerge = (sourceName: string) => {
    const targetName = window.prompt(`你想将标签「${sourceName}」合并到哪个标签？\n（输入目标标签的名称）`);
    if (!targetName || targetName.trim() === '' || targetName === sourceName) return;
    
    const trimmed = targetName.trim();
    
    setFiles(prev => prev.map(file => {
      const currentTags = file.attributes[selectedDimension];
      if (!currentTags || !currentTags.includes(sourceName)) return file;
      
      // Remove sourceName, add targetName
      const newTags = currentTags.filter(t => t !== sourceName);
      if (!newTags.includes(trimmed)) {
        newTags.push(trimmed);
      }
      
      return {
        ...file,
        attributes: {
          ...file.attributes,
          [selectedDimension]: newTags
        }
      };
    }));
  };

  const handleDeleteClick = (tagName: string) => {
    setTagToDelete(tagName);
  };

  const confirmDelete = () => {
    if (!tagToDelete) return;
    setFiles(prev => prev.map(file => {
      const currentTags = file.attributes[selectedDimension];
      if (!currentTags || !currentTags.includes(tagToDelete)) return file;
      
      return {
        ...file,
        attributes: {
          ...file.attributes,
          [selectedDimension]: currentTags.filter(t => t !== tagToDelete)
        }
      };
    }));
    setTagToDelete(null);
  };

  // Deterministic color generation based on string
  const getTagColor = (tagName: string) => {
    let hash = 0;
    for (let i = 0; i < tagName.length; i++) {
        hash = tagName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 70%, 90%)`;
  };

  const getTextColor = (tagName: string) => {
    let hash = 0;
    for (let i = 0; i < tagName.length; i++) {
        hash = tagName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 80%, 25%)`;
  };

  return (
    <div className="flex flex-col h-full w-full bg-white">
      {/* Top Header */}
      <div className="h-16 border-b border-gray-200 flex items-center px-6 bg-white shadow-sm shrink-0">
        <button 
          onClick={onClose}
          className="flex items-center gap-2 text-gray-500 hover:text-indigo-600 transition-colors font-medium px-4 py-2 rounded-lg hover:bg-indigo-50"
        >
          <ArrowLeft className="w-5 h-5" />
          返回文件浏览
        </button>
        <div className="h-6 w-px bg-gray-200 mx-6"></div>
        <h1 className="text-xl font-bold text-gray-800">
          ⚙️ 系统设置 <span className="text-gray-400">/</span>
          <span className="text-indigo-600">属性管理</span>
        </h1>
      </div>

      {/* Main Content: Two Panes */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Left Pane: Dimensions */}
        <div className="w-72 bg-gray-50 border-r border-gray-200 flex flex-col hide-scrollbar relative">
          <button 
            className="p-4 border-b border-gray-200 flex items-center justify-between w-full hover:bg-gray-100 transition-colors"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
              可用属性维度
            </h2>
            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-300 ${!isExpanded ? '-rotate-90' : ''}`} />
          </button>
          
          <div className={`transition-all duration-300 ease-in-out overflow-hidden flex flex-col min-h-0 ${isExpanded ? 'flex-1 opacity-100' : 'flex-none h-0 opacity-0'}`}>
            <div className="flex-1 overflow-y-auto p-4 space-y-1 pb-16">
              {dimensions.map(dim => (
                <div
                  key={dim.sys_id}
                  className={`group relative flex items-center justify-between w-full text-left px-4 py-3 rounded-lg font-medium transition-all cursor-pointer ${
                    selectedDimension === dim.WHMC 
                      ? 'bg-indigo-100 text-indigo-700 shadow-sm border border-indigo-200' 
                      : 'text-gray-600 hover:bg-gray-100 border border-transparent'
                  }`}
                  onClick={() => setSelectedDimension(dim.WHMC)}
                >
                  <span className="truncate pr-8">{dim.WHMC}</span>
                  <div className="absolute right-3 hidden group-hover:flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDimInput(dim.WHMC);
                        setDimError(null);
                        setDimModalConfig({ isOpen: true, mode: 'edit', dimId: dim.sys_id, initialName: dim.WHMC });
                      }}
                      className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-white rounded transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteDimConfig({ isOpen: true, dimId: dim.sys_id, dimName: dim.WHMC });
                        setDimError(null);
                      }}
                      className="p-1 text-gray-400 hover:text-red-600 hover:bg-white rounded transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {isExpanded && (
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-gray-50 via-gray-50 to-transparent border-t border-gray-100/50 backdrop-blur-sm">
                <button
                  onClick={() => {
                    setDimInput('');
                    setDimError(null);
                    setDimModalConfig({ isOpen: true, mode: 'create' });
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-indigo-300 rounded-lg text-indigo-600 hover:bg-indigo-50 transition-colors text-sm font-medium shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  新建维度
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Pane: Tags */}
        <div className="flex-1 overflow-y-auto bg-white p-8">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
              <span className="text-indigo-600 px-3 py-1 bg-indigo-50 rounded-md text-xl">
                {selectedDimension}
              </span>
              维度下的标签
            </h2>

            {tagStats.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-16 border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50">
                <span className="text-4xl mb-4">🏷️</span>
                <p className="text-gray-500 font-medium">当前维度下暂无标签</p>
                <p className="text-gray-400 text-sm mt-1">在文件视图中为文件添加该维度标签后即可在此管理</p>
              </div>
            ) : (
              <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-6 py-4 text-sm font-semibold text-gray-500 w-1/3">标签名称 / 颜色</th>
                      <th className="px-6 py-4 text-sm font-semibold text-gray-500 w-1/4">使用情况</th>
                      <th className="px-6 py-4 text-sm font-semibold text-gray-500 text-right w-1/3">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {tagStats.map(stat => {
                      const isComputed = selectedDimension === '文件类型';
                      return (
                      <tr key={stat.name} className="hover:bg-gray-50/50 transition-colors group">
                        <td className="px-6 py-4">
                          <span 
                            className="px-3 py-1 rounded-full text-sm font-medium border shadow-sm"
                            style={{ 
                              backgroundColor: getTagColor(stat.name), 
                              color: getTextColor(stat.name),
                              borderColor: 'rgba(0,0,0,0.05)'
                            }}
                          >
                            {stat.name}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="flex items-center gap-1.5 text-gray-600 text-sm font-medium">
                            <span className="inline-block w-2 h-2 rounded-full bg-green-400"></span>
                            {stat.count} 个文件
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          {isComputed ? (
                            <span className="text-gray-400 text-xs italic px-2">系统计算属性不可改</span>
                          ) : (
                            <div className="flex items-center justify-end gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => handleRename(stat.name)}
                                className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors tooltip"
                                title="重命名"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => handleMerge(stat.name)}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                                title="合并到..."
                              >
                                <Merge className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => handleDeleteClick(stat.name)}
                                className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors ml-2"
                                title="彻底删除"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )})}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {tagToDelete && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200 p-4"
          onClick={() => setTagToDelete(null)}
        >
          <div 
            className="bg-white rounded-xl shadow-2xl w-full max-w-[480px] overflow-hidden transform transition-all animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-2 flex items-center gap-2">
                <Trash2 className="w-6 h-6 text-red-500" />
                确认彻底删除标签
              </h3>
              
              <div className="text-gray-600 mb-6 leading-relaxed mt-4">
                <p>确定要从所有文件中移除以下标签吗？</p>
                <div className="my-4 p-3 bg-gray-50 border border-gray-200 rounded-lg text-center break-all shadow-inner">
                  <span className="font-semibold text-gray-900 text-lg">「{tagToDelete}」</span>
                </div>
                <div className="text-red-600 text-sm mt-4 bg-red-50 p-3 rounded-md border border-red-100 flex items-start gap-2">
                  <span className="shrink-0 text-base leading-none">⚠️</span>
                  <span>此操作会将所有绑定了该标签的文件中移除此标签，一旦删除将无法恢复。</span>
                </div>
              </div>
              
              <div className="flex items-center justify-end gap-3 mt-8">
                <button
                  onClick={() => setTagToDelete(null)}
                  className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition-colors focus:outline-none"
                >
                  取消
                </button>
                <button
                  onClick={confirmDelete}
                  className="px-5 py-2 bg-red-500 text-white font-medium hover:bg-red-600 rounded-lg shadow-sm shadow-red-500/20 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                >
                  确认删除
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {dimModalConfig.isOpen && (
        <div 
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => {
            if (!isDimSubmitting) setDimModalConfig({ isOpen: false, mode: 'create' });
          }}
        >
          <div 
            className="w-[420px] overflow-hidden rounded-xl bg-white shadow-xl animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border bg-[#FBFBFA] p-4">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <Tag className="w-4 h-4 text-indigo-500" />
                {dimModalConfig.mode === 'create' ? '新建维度' : '重命名维度'}
              </h2>
              <button
                onClick={() => setDimModalConfig({ isOpen: false, mode: 'create' })}
                disabled={isDimSubmitting}
                className="rounded-md p-1 transition-colors hover:bg-gray-200 disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">维度名称</label>
                <input
                  type="text"
                  value={dimInput}
                  onChange={(e) => setDimInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleDimSubmit()}
                  autoFocus
                  className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="请输入维度名称..."
                  disabled={isDimSubmitting}
                />
              </div>
              {dimError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                  {dimError}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 border-t border-border bg-[#FBFBFA] p-4">
              <button
                onClick={() => setDimModalConfig({ isOpen: false, mode: 'create' })}
                disabled={isDimSubmitting}
                className="rounded-md border border-border px-5 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-gray-100 disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleDimSubmit}
                disabled={isDimSubmitting || !dimInput.trim()}
                className="flex items-center justify-center gap-2 rounded-md bg-indigo-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50 min-w-[80px]"
              >
                {isDimSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : '确认'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteDimConfig.isOpen && (
        <div 
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => {
            if (!isDimDeleting) setDeleteDimConfig({ isOpen: false });
          }}
        >
          <div 
            className="w-[520px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl bg-white shadow-xl animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border bg-[#FBFBFA] p-4">
              <div className="flex items-center gap-2">
                <div className="rounded-full bg-red-100 p-2 text-red-600">
                  <Trash2 className="h-4 w-4" />
                </div>
                <h2 className="font-semibold text-gray-900">彻底删除维度</h2>
              </div>
              <button
                onClick={() => setDeleteDimConfig({ isOpen: false })}
                disabled={isDimDeleting}
                className="rounded-md p-1 transition-colors hover:bg-gray-200 disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 p-5">
              <div className="rounded-lg border border-red-100 bg-red-50 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">确定要彻底删除该维度吗？</p>
                    <p className="mt-1 break-all text-sm text-gray-600 font-semibold">「{deleteDimConfig.dimName}」</p>
                    <p className="mt-2 text-xs text-gray-500 leading-relaxed">
                      警告：这将会级联删除该维度下的所有标签，并移除所有文件上的相关标签数据！此操作不可恢复。
                    </p>
                  </div>
                </div>
              </div>
              {dimError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                  {dimError}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 border-t border-border bg-[#FBFBFA] p-4">
              <button
                onClick={() => setDeleteDimConfig({ isOpen: false })}
                disabled={isDimDeleting}
                className="rounded-md border border-border px-5 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-gray-100 disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleDimDeleteConfirm}
                disabled={isDimDeleting}
                className="flex items-center justify-center gap-2 rounded-md bg-red-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:bg-red-400 min-w-[112px]"
              >
                {isDimDeleting ? <><Loader2 className="h-4 w-4 animate-spin" />删除中...</> : '确认删除'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
