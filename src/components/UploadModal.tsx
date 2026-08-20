import { useState, useMemo } from 'react';
import { X, UploadCloud, Tag } from 'lucide-react';
import type { FileItem } from '../lib/types';

const QUICK_TAG_LIMIT = 4;
const RECOMMENDATION_LIMIT = 8;
const FILENAME_HINT_KEYWORDS = [
  '土地租赁',
  '租赁',
  '协议',
  '合同',
  '补充',
  '意向书',
  '建设用地',
  '使用权',
  '决策',
  '投资',
  '股权',
  '前期',
  '建设期',
  '运营期',
];

interface AttributeRecommendation {
  dimension: string;
  value: string;
  score: number;
}

const normalizeFileNameForMatch = (name: string) =>
  name
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/\s+/g, '');

const buildTagMatchTokens = (tag: string) => {
  const normalized = tag.toLowerCase().replace(/\s+/g, '');
  const tokens = new Set<string>();

  FILENAME_HINT_KEYWORDS.forEach(keyword => {
    if (normalized.includes(keyword.toLowerCase())) tokens.add(keyword.toLowerCase());
  });

  for (let size = 4; size >= 3; size -= 1) {
    for (let i = 0; i <= normalized.length - size; i += 1) {
      tokens.add(normalized.slice(i, i + size));
    }
  }

  return [...tokens].filter(token => token.length >= 3);
};

const scoreTagAgainstNames = (tag: string, normalizedNames: string[]) => {
  const normalizedTag = tag.toLowerCase().replace(/\s+/g, '');
  const tokens = buildTagMatchTokens(tag);

  return normalizedNames.reduce((score, name) => {
    if (normalizedTag && name.includes(normalizedTag)) return score + 4;
    const tokenHits = tokens.filter(token => name.includes(token)).length;
    return score + Math.min(tokenHits, 3);
  }, 0);
};

interface UploadModalProps {
  files: FileItem[];
  onConfirm: (files: FileItem[]) => void;
  onCancel: () => void;
  dimensionOrder: string[];
  availableDimensions: string[];
  availableTagValues?: Record<string, string[]>; // 所有已有标签
}

export function UploadModal({ files, onConfirm, onCancel, dimensionOrder, availableDimensions, availableTagValues = {} }: UploadModalProps) {
  const [stagedFiles, setStagedFiles] = useState<FileItem[]>(files);
  const [batchDim, setBatchDim] = useState(dimensionOrder[0] || '项目');
  const [batchVal, setBatchVal] = useState('');
  const [expandedQuickTagGroups, setExpandedQuickTagGroups] = useState<Set<string>>(new Set());
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(() => new Set(files.map(file => file.id)));

  const selectedFiles = useMemo(
    () => stagedFiles.filter(file => selectedFileIds.has(file.id)),
    [stagedFiles, selectedFileIds]
  );

  const selectedCount = selectedFiles.length;
  const allFilesSelected = stagedFiles.length > 0 && selectedCount === stagedFiles.length;

  const inheritedAttributeEntries = useMemo(() => {
    if (stagedFiles.length === 0) return [];
    const firstFileAttributes = stagedFiles[0].attributes;

    return Object.entries(firstFileAttributes)
      .filter(([, values]) => values.length > 0)
      .filter(([dimension, values]) => stagedFiles.every(file => {
        const fileValues = file.attributes[dimension] || [];
        return values.every(value => fileValues.includes(value));
      }));
  }, [stagedFiles]);

  // 当前选中的维度下，已有的标签列表（排重）
  const existingTagsForDim = useMemo(() => {
    return availableTagValues[batchDim] || [];
  }, [availableTagValues, batchDim]);

  const attributeRecommendations = useMemo<AttributeRecommendation[]>(() => {
    const targetFiles = selectedFiles.length > 0 ? selectedFiles : stagedFiles;
    if (targetFiles.length === 0) return [];

    const normalizedNames = targetFiles.map(file => normalizeFileNameForMatch(file.name));
    const recommendations: AttributeRecommendation[] = [];

    for (const [dimension, tagValues] of Object.entries(availableTagValues)) {
      for (const value of tagValues) {
        const alreadyAppliedToAll = targetFiles.every(file => (file.attributes[dimension] || []).includes(value));
        if (alreadyAppliedToAll) continue;

        const score = scoreTagAgainstNames(value, normalizedNames);
        if (score > 0) recommendations.push({ dimension, value, score });
      }
    }

    return recommendations
      .sort((a, b) => b.score - a.score || a.dimension.localeCompare(b.dimension, 'zh-CN') || a.value.localeCompare(b.value, 'zh-CN'))
      .slice(0, RECOMMENDATION_LIMIT);
  }, [availableTagValues, selectedFiles, stagedFiles]);

  // 已应用到所有文件的标签集合（用于标记哪些已有标签已被选）
  const appliedBatchTags = useMemo(() => {
    if (selectedFiles.length === 0) return new Set<string>();
    const firstFileTags = new Set(selectedFiles[0].attributes[batchDim] || []);
    // 检查是否所有文件都有相同的 tag
    for (let i = 1; i < selectedFiles.length; i++) {
      const tags = new Set(selectedFiles[i].attributes[batchDim] || []);
      for (const t of firstFileTags) {
        if (!tags.has(t)) firstFileTags.delete(t);
      }
    }
    return firstFileTags;
  }, [selectedFiles, batchDim]);

  // ——— 批量操作 ———

  const handleBatchApplyTag = (tagValue: string) => {
    const val = tagValue.trim();
    if (!val || selectedFileIds.size === 0) return;
    setStagedFiles(prev => prev.map(f => {
      if (!selectedFileIds.has(f.id)) return f;
      const updatedAttrs = { ...f.attributes };
      if (!updatedAttrs[batchDim]) updatedAttrs[batchDim] = [];
      if (!updatedAttrs[batchDim].includes(val)) {
        updatedAttrs[batchDim] = [...updatedAttrs[batchDim], val];
      }
      return { ...f, attributes: updatedAttrs };
    }));
    setBatchVal('');
  };

  const handleBatchRemoveTag = (val: string) => {
    setStagedFiles(prev => prev.map(f => {
      if (!selectedFileIds.has(f.id)) return f;
      const updatedAttrs = { ...f.attributes };
      if (updatedAttrs[batchDim]) {
        updatedAttrs[batchDim] = updatedAttrs[batchDim].filter(v => v !== val);
      }
      return { ...f, attributes: updatedAttrs };
    }));
  };

  const handleApplyRecommendation = (dimension: string, value: string) => {
    if (selectedFileIds.size === 0) return;
    setStagedFiles(prev => prev.map(f => {
      if (!selectedFileIds.has(f.id)) return f;
      const updatedAttrs = { ...f.attributes };
      if (!updatedAttrs[dimension]) updatedAttrs[dimension] = [];
      if (!updatedAttrs[dimension].includes(value)) {
        updatedAttrs[dimension] = [...updatedAttrs[dimension], value];
      }
      return { ...f, attributes: updatedAttrs };
    }));
  };

  const toggleFileSelection = (fileId: string) => {
    setSelectedFileIds(prev => {
      const next = new Set(prev);
      if (next.has(fileId)) next.delete(fileId);
      else next.add(fileId);
      return next;
    });
  };

  const toggleAllFiles = () => {
    setSelectedFileIds(allFilesSelected ? new Set() : new Set(stagedFiles.map(file => file.id)));
  };

  // ——— 单个文件操作 ———

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

  const handleFileAddTag = (fileId: string, dim: string, val: string) => {
    setStagedFiles(prev => prev.map(f => {
      if (f.id !== fileId) return f;
      const updatedAttrs = { ...f.attributes };
      if (!updatedAttrs[dim]) updatedAttrs[dim] = [];
      if (!updatedAttrs[dim].includes(val)) {
        updatedAttrs[dim] = [...updatedAttrs[dim], val];
      }
      return { ...f, attributes: updatedAttrs };
    }));
  };

  const toggleQuickTagGroup = (fileId: string, dim: string) => {
    const groupKey = `${fileId}::${dim}`;
    setExpandedQuickTagGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-[700px] max-h-[85vh] flex flex-col overflow-hidden">
        {/* 头部 */}
        <div className="p-4 border-b border-border flex justify-between items-center bg-[#FBFBFA]">
          <h2 className="font-semibold flex items-center gap-2">
            <UploadCloud className="w-5 h-5 text-indigo-500" />
            上传解析 ({stagedFiles.length} 个文件)
          </h2>
          <button onClick={onCancel} className="p-1 hover:bg-gray-200 rounded-md transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {inheritedAttributeEntries.length > 0 && (
          <div className="border-b border-indigo-100 bg-indigo-50/60 px-4 py-3 text-xs text-indigo-900">
            <div className="mb-2 flex items-center gap-1.5 font-semibold">
              <Tag className="h-3.5 w-3.5" />
              将继承当前视图属性
            </div>
            <div className="flex flex-wrap gap-1.5">
              {inheritedAttributeEntries.map(([dimension, values]) => (
                <span key={dimension} className="rounded-full border border-indigo-100 bg-white px-2 py-0.5 text-indigo-700">
                  <span className="text-indigo-400">{dimension}:</span> {values.join('、')}
                </span>
              ))}
            </div>
          </div>
        )}
        
        {/* 批量打标签区域 */}
        <div className="p-4 border-b border-border bg-indigo-50/50 space-y-3">
          <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider flex items-center gap-2">
            <Tag className="w-4 h-4" />
            批量打标签 (应用到已选文件)
          </h3>

          <div className="flex items-center justify-between text-xs text-gray-500">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={allFilesSelected}
                onChange={toggleAllFiles}
                className="h-3.5 w-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>已选 {selectedCount} / {stagedFiles.length} 个文件</span>
            </label>
            <button
              type="button"
              onClick={toggleAllFiles}
              className="font-medium text-indigo-600 hover:text-indigo-700"
            >
              {allFilesSelected ? '取消全选' : '全选'}
            </button>
          </div>

          {/* 维度选择 + 自定义输入 */}
          <div className="flex gap-2 text-sm">
            <select 
              value={batchDim} 
              onChange={e => setBatchDim(e.target.value)}
              className="border border-border rounded px-2 py-1 outline-none bg-white min-w-[100px]"
            >
              {availableDimensions.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <input 
              type="text" 
              value={batchVal}
              onChange={e => setBatchVal(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleBatchApplyTag(batchVal)}
              placeholder="自定义输入标签值回车..."
              className="flex-1 border border-border rounded px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-500 min-w-0"
            />
            <button 
              onClick={() => handleBatchApplyTag(batchVal)}
              disabled={selectedCount === 0}
              className="bg-indigo-600 text-white px-4 py-1.5 rounded hover:bg-indigo-700 transition-colors shadow-sm whitespace-nowrap disabled:cursor-not-allowed disabled:bg-indigo-300"
            >
              应用
            </button>
          </div>

          {/* 选择已有标签（标签云） */}
          {attributeRecommendations.length > 0 && (
            <div>
              <div className="text-xs text-text-secondary mb-1.5">
                根据文件名推荐属性（点击应用到已选文件）：
              </div>
              <div className="flex flex-wrap gap-1.5">
                {attributeRecommendations.map(item => (
                  <button
                    key={`${item.dimension}-${item.value}`}
                    type="button"
                    disabled={selectedCount === 0}
                    onClick={() => handleApplyRecommendation(item.dimension, item.value)}
                    className="text-xs px-2 py-0.5 rounded-full border border-indigo-100 bg-white text-indigo-600 hover:bg-indigo-50 hover:border-indigo-200 disabled:cursor-not-allowed disabled:text-gray-300 disabled:border-gray-100"
                    title={`${item.dimension}: ${item.value}`}
                  >
                    + {item.dimension}: {item.value}
                  </button>
                ))}
              </div>
            </div>
          )}

          {existingTagsForDim.length > 0 && (
            <div>
              <div className="text-xs text-text-secondary mb-1.5">
                选择已有 <span className="font-semibold text-indigo-600">{batchDim}</span> 标签（点击添加到已选文件）：
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-[72px] overflow-y-auto">
                {existingTagsForDim.map(tag => {
                  const isApplied = appliedBatchTags.has(tag);
                  return (
                    <button
                      key={tag}
                      onClick={() => {
                        if (isApplied) handleBatchRemoveTag(tag);
                        else handleBatchApplyTag(tag);
                      }}
                      className={[
                        'text-xs px-2 py-0.5 rounded-full border transition-all cursor-pointer',
                        isApplied
                          ? 'bg-indigo-100 text-indigo-700 border-indigo-200 shadow-sm'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300 hover:text-indigo-600'
                      ].join(' ')}
                    >
                      {tag}
                      {isApplied && <span className="ml-1 text-indigo-400">✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* 文件列表 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {stagedFiles.map(file => {
            // 计算可用的维度列表（按 dimensionOrder 排序）
            const fileDims = availableDimensions.filter(d => {
              const vals = file.attributes[d] || [];
              return vals.length > 0;
            });
            const remainingDims = availableDimensions.filter(d => {
              const vals = file.attributes[d] || [];
              return vals.length === 0;
            });

            return (
              <div key={file.id} className={[
                'border rounded-lg p-3 shadow-sm transition-colors',
                selectedFileIds.has(file.id) ? 'border-indigo-200 bg-indigo-50/20' : 'border-border hover:border-indigo-200'
              ].join(' ')}>
                {/* 文件名 */}
                <div className="font-medium text-sm mb-2 truncate flex items-center gap-2" title={file.name}>
                  <input
                    type="checkbox"
                    checked={selectedFileIds.has(file.id)}
                    onChange={() => toggleFileSelection(file.id)}
                    className="h-3.5 w-3.5 shrink-0 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="truncate">{file.name}</span>
                </div>
                
                {/* 已有标签 */}
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {fileDims.map(dim => 
                    (file.attributes[dim] || []).map(val => (
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
                  
                  {/* 无标签标记 */}
                  {fileDims.length === 0 && (
                    <span className="text-xs text-amber-500 italic bg-amber-50 px-2 py-0.5 rounded border border-amber-200">待分类 (将进入 Inbox)</span>
                  )}
                </div>

                {/* 为每个文件独立添加标签的快捷按钮 */}
                {remainingDims.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1.5 border-t border-dashed border-gray-100">
                    {remainingDims.map(dim => {
                      const dimTags = availableTagValues[dim] || [];
                      // 已在该文件上应用的该维度的标签
                      const fileDimTags = new Set(file.attributes[dim] || []);
                      const usableTags = dimTags.filter(t => !fileDimTags.has(t));
                      const groupKey = `${file.id}::${dim}`;
                      const isExpanded = expandedQuickTagGroups.has(groupKey);
                      const visibleTags = isExpanded ? usableTags : usableTags.slice(0, QUICK_TAG_LIMIT);
                      const hiddenTagCount = usableTags.length - QUICK_TAG_LIMIT;
                      
                      return usableTags.length > 0 ? (
                        <div key={dim} className="flex items-center gap-1 flex-wrap">
                          <span className="text-[10px] text-gray-400 font-medium">{dim}:</span>
                          <div className="flex flex-wrap gap-1">
                            {visibleTags.map(tag => (
                              <button
                                key={tag}
                                onClick={() => handleFileAddTag(file.id, dim, tag)}
                                className="text-[10px] px-1.5 py-0.5 rounded bg-gray-50 text-gray-500 border border-gray-200 
                                           hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 
                                           transition-all cursor-pointer whitespace-nowrap"
                                title={`添加 "${tag}"`}
                              >
                                +{tag}
                              </button>
                            ))}
                            {hiddenTagCount > 0 && (
                              <button
                                type="button"
                                onClick={() => toggleQuickTagGroup(file.id, dim)}
                                className="text-[10px] px-1.5 py-0.5 rounded bg-white text-indigo-500 border border-indigo-100 hover:bg-indigo-50 hover:border-indigo-200 transition-colors whitespace-nowrap"
                                title={isExpanded ? '收起标签' : '展开更多标签'}
                              >
                                {isExpanded ? '收起' : `+${hiddenTagCount}更多`}
                              </button>
                            )}
                          </div>
                        </div>
                      ) : null;
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 底部按钮 */}
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
