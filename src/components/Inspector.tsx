import { useState, useRef, useEffect, Fragment } from 'react';
import { useSearchParams } from 'react-router-dom';
import { X, Plus, Network, Tag, Calendar, Building, Briefcase, FileType, CheckCircle2, FileText, FileSpreadsheet, Image, Presentation, File as FileIcon, Trash2, ExternalLink, Download } from 'lucide-react';
import type { FileItem } from '../lib/types';
import { findPathsForFile } from '../lib/tree';
import { RenameFileName } from './RenameFileName';

// Linear style precise tag coloring
const getTagStyle = (tagName: string) => {
  let hash = 0;
  for (let i = 0; i < tagName.length; i++) hash = tagName.charCodeAt(i) + ((hash << 5) - hash);
  const hues = [
    { bg: '#fee2e2', text: '#991b1b' }, // red
    { bg: '#ffedd5', text: '#9a3412' }, // orange
    { bg: '#fef3c7', text: '#92400e' }, // yellow
    { bg: '#dcfce7', text: '#166534' }, // green
    { bg: '#dbeafe', text: '#1e40af' }, // blue
    { bg: '#ece9fe', text: '#5b21b6' }, // violet
    { bg: '#fce7f3', text: '#9d174d' }, // pink
    { bg: '#f3f4f6', text: '#374151' }, // gray
  ];
  return hues[Math.abs(hash) % hues.length];
};

const getDimIcon = (dim: string) => {
  switch (dim) {
    case '部门': return <Building className="w-3.5 h-3.5" />;
    case '年份': return <Calendar className="w-3.5 h-3.5" />;
    case '项目': return <Briefcase className="w-3.5 h-3.5" />;
    case '档案分类':
    case '档案类别': return <FileType className="w-3.5 h-3.5" />;
    case '状态': return <CheckCircle2 className="w-3.5 h-3.5" />;
    default: return <Tag className="w-3.5 h-3.5" />;
  }
};

const getFileIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'pdf': return <FileText className="w-5 h-5 text-red-500" />;
      case 'xlsx': return <FileSpreadsheet className="w-5 h-5 text-green-600" />;
      case 'docx': return <FileText className="w-5 h-5 text-blue-600" />;
      case 'pptx': return <Presentation className="w-5 h-5 text-orange-500" />;
      case 'fig': return <Image className="w-5 h-5 text-purple-500" />;
      case 'md': return <FileText className="w-5 h-5 text-gray-600" />;
      default: return <FileIcon className="w-5 h-5 text-gray-400" />;
    }
};

interface InspectorProps {
  selectedFile: FileItem | undefined;
  allFiles: FileItem[];
  dimensionOrder: string[];
  availableDimensions: string[];
  onUpdateAttributes: (id: string, newAttrs: Record<string, string[]>) => void;
  onDeleteFile: (id: string) => void | Promise<void>;
  onClose: () => void;
}

export function Inspector({ selectedFile, allFiles, dimensionOrder, availableDimensions, onUpdateAttributes, onDeleteFile, onClose }: InspectorProps) {
  const [newTagInput, setNewTagInput] = useState<{ dim: string; val: string }>({ dim: '', val: '' });
  const [showAddDimMenu, setShowAddDimMenu] = useState(false);
  const [forceVisibleDims, setForceVisibleDims] = useState<Set<string>>(new Set());
  const [searchParams, setSearchParams] = useSearchParams();
  
  const inputRef = useRef<HTMLInputElement>(null);
  const skipNextBlurSubmitRef = useRef(false);

  useEffect(() => {
    if (newTagInput.dim && inputRef.current) {
      inputRef.current.focus();
    }
  }, [newTagInput.dim]);

  useEffect(() => {
    skipNextBlurSubmitRef.current = false;
    setForceVisibleDims(new Set());
    setNewTagInput({ dim: '', val: '' });
    setShowAddDimMenu(false);
  }, [selectedFile?.id]);

  if (!selectedFile) {
    return (
      <div className="w-80 border-l border-border bg-[#FBFBFA]/80 p-6 flex flex-col items-center justify-center text-text-secondary h-full text-sm">
        <div className="w-16 h-16 bg-white rounded-full flex justify-center items-center mb-5 border border-gray-100 shadow-sm">
          <FileText className="w-6 h-6 text-gray-300" />
        </div>
        <h3 className="text-gray-900 font-semibold mb-1 text-sm tracking-tight">选中一个文件查看属性</h3>
        <p className="text-gray-400 text-xs text-center leading-relaxed mt-1">支持多维度属性管理</p>
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
    // If we removed the last tag, keep the dimension visible temporarily
    if (!updatedAttrs[dim] || updatedAttrs[dim].length === 0) {
      setForceVisibleDims(prev => new Set(prev).add(dim));
    }
    onUpdateAttributes(selectedFile.id, updatedAttrs);
  };

  const beginAddingTag = (dim: string) => {
    skipNextBlurSubmitRef.current = false;
    setNewTagInput({ dim, val: '' });
  };

  const cancelAddingTag = () => {
    skipNextBlurSubmitRef.current = false;
    setNewTagInput({ dim: '', val: '' });
  };

  const handleAddTag = (dim: string, forceVal?: string) => {
    const valToAdd = (forceVal !== undefined ? forceVal : newTagInput.val).trim();
    if (!valToAdd) {
      cancelAddingTag();
      return;
    }
    const updatedAttrs = { ...selectedFile.attributes };
    updatedAttrs[dim] = [...(updatedAttrs[dim] || [])];
    if (!updatedAttrs[dim].includes(valToAdd)) {
      updatedAttrs[dim].push(valToAdd);
    }
    skipNextBlurSubmitRef.current = true;  // Only suppress a follow-up blur submit from this same edit.
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

  const activeDimensions = availableDimensions.filter(dim => {
    const hasValues = selectedFile.attributes[dim] && selectedFile.attributes[dim].length > 0;
    return hasValues || forceVisibleDims.has(dim);
  });

  const emptyDimensions = availableDimensions.filter(dim => !activeDimensions.includes(dim));

  const virtualPaths = findPathsForFile(allFiles, dimensionOrder, selectedFile.id);

  return (
    <div className="w-[340px] border-l border-border bg-[#FBFBFA]/50 flex flex-col h-full text-sm">
      {/* Compact Header */}
      <div className="px-5 py-4 border-b border-border bg-[#FBFBFA]/80 flex items-start gap-3 backdrop-blur-sm sticky top-0 z-10 shrink-0">
        <div className="mt-0.5 shrink-0">
          {getFileIcon(selectedFile.type)}
        </div>
        <div className="flex-1 min-w-0">
          <RenameFileName
            file={selectedFile}
            siblingFiles={allFiles}
            className="mb-1 max-w-full"
            textClassName="font-semibold text-gray-900 text-[13px] leading-tight"
            inputClassName="text-[13px]"
          />
          <div className="text-[11px] text-gray-500 font-medium">
            <span>{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</span>
            <span className="mx-1.5">•</span>
            <span className="uppercase">{selectedFile.type}</span>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="text-gray-400 hover:text-gray-800 hover:bg-gray-200 p-1 rounded transition-colors shrink-0 -mt-1 -mr-1"
          title="关闭"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-5">
        <div className="mb-6">
          <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-3 px-1">
            属性 (Properties)
          </h3>
          
          {/* Notion/Linear Style Property List */}
          <div className="flex flex-col border border-gray-100 rounded-lg bg-white shadow-sm divide-y divide-gray-100">
            {activeDimensions.map(dim => {
              const values = selectedFile.attributes[dim] || [];
              const isAdding = newTagInput.dim === dim;
              const isComputed = dim === '文件类型';
              
              const existingTags = isAdding ? getExistingTags(dim) : [];
              const filteredTags = existingTags.filter(t => 
                t.toLowerCase().includes(newTagInput.val.toLowerCase()) && 
                !values.includes(t)
              );
              
              return (
                <div key={dim} className="flex min-h-[40px] py-1.5 px-3 hover:bg-gray-50/50 transition-colors group first:rounded-t-lg last:rounded-b-lg relative">
                  <div className="w-[90px] shrink-0 flex items-center gap-2 text-gray-500 py-1 font-medium text-xs select-none">
                    <span className="opacity-70">{getDimIcon(dim)}</span>
                    <span className="truncate" title={dim}>{dim}</span>
                  </div>
                  
                  <div className="flex-1 flex flex-wrap items-center gap-1.5 relative min-w-0 py-0.5 ml-2">
                    {values.length === 0 && !isAdding && (
                      <span className="text-gray-300 text-xs italic px-1 h-6 flex items-center">Empty</span>
                    )}

                    {values.map(val => {
                      const style = getTagStyle(val);
                      return (
                        <div key={val} className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium group/pill" style={{ backgroundColor: style.bg, color: style.text }}>
                          <span className="truncate max-w-[120px]">{val}</span>
                          {!isComputed && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleRemoveTag(dim, val); }}
                              className="opacity-0 group-hover/pill:opacity-100 hover:bg-black/10 rounded-sm p-0.5 transition-all -mr-1"
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                          )}
                        </div>
                      )
                    })}
                    
                    {isAdding ? (
                      <div className="relative flex-1 min-w-[100px] flex items-center">
                        <input 
                          ref={inputRef}
                          type="text" 
                          value={newTagInput.val}
                          onChange={(e) => setNewTagInput({ dim, val: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAddTag(dim, newTagInput.val);
                            if (e.key === 'Escape') cancelAddingTag();
                          }}
                          onBlur={(e) => {
                            if (skipNextBlurSubmitRef.current) {
                              skipNextBlurSubmitRef.current = false;
                              return;
                            }
                            const value = e.currentTarget.value;
                            setTimeout(() => handleAddTag(dim, value), 150);
                          }}
                          className="flex-1 bg-transparent border-none p-0 focus:ring-0 text-xs text-gray-800 outline-none w-full h-6 placeholder-gray-300"
                          placeholder="Type a tag..."
                        />
                        
                        {filteredTags.length > 0 && (
                          <div className="absolute top-full left-0 mt-1 min-w-[140px] bg-white border border-gray-100 shadow-xl rounded-lg max-h-40 overflow-y-auto z-20 overflow-hidden py-1">
                            {filteredTags.map(tag => {
                              const style = getTagStyle(tag);
                              return (
                                <div 
                                  key={tag}
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    handleAddTag(dim, tag);
                                  }}
                                  className="px-3 py-1.5 hover:bg-gray-50 cursor-pointer transition-colors"
                                >
                                  <span className="px-2 py-0.5 rounded-md text-[11px] font-medium inline-block" style={{ backgroundColor: style.bg, color: style.text }}>
                                    {tag}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ) : (
                      !isComputed && (
                        <button 
                          onClick={() => beginAddingTag(dim)}
                          className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-800 hover:bg-gray-100 transition-all rounded p-0.5 h-5 flex items-center justify-center -ml-0.5"
                          title="Add tag"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      )
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Add Property Button */}
          {emptyDimensions.length > 0 && (
            <div className="mt-2 relative">
              <button 
                onClick={() => setShowAddDimMenu(!showAddDimMenu)}
                className="text-xs text-gray-400 hover:text-gray-800 flex items-center gap-1.5 px-2 py-1.5 rounded-md hover:bg-gray-100 transition-colors font-medium w-full text-left"
              >
                <Plus className="w-3.5 h-3.5" />
                添加属性...
              </button>
              
              {showAddDimMenu && (
                <div className="absolute top-full left-0 mt-1 w-[200px] bg-white border border-gray-100 shadow-xl rounded-lg z-20 py-1 overflow-hidden">
                  <div className="px-3 py-1.5 text-[10px] uppercase font-semibold text-gray-400 tracking-wider">选择属性维度</div>
                  {emptyDimensions.map(dim => (
                    <button
                      key={dim}
                      onClick={() => {
                        setForceVisibleDims(prev => new Set(prev).add(dim));
                        setShowAddDimMenu(false);
                        beginAddingTag(dim);
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors"
                    >
                      <span className="opacity-60">{getDimIcon(dim)}</span>
                      {dim}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-3 px-1 flex items-center gap-1.5">
          <Network className="w-3.5 h-3.5" />
          虚拟目录映射
        </h3>
        {virtualPaths.length > 0 ? (
          <div className="space-y-1.5 border border-gray-100 rounded-lg p-3 bg-white shadow-sm">
            {virtualPaths.map((path, idx) => (
              <div key={idx} className="bg-gray-50 rounded px-2.5 py-1.5 text-[11px] text-gray-500 flex gap-1 items-center flex-wrap">
                {path.length === 0 ? <span className="text-gray-400 italic">根目录</span> : null}
                {path.map((segment, i) => (
                  <Fragment key={i}>
                    <span className="text-gray-800 font-medium">{segment}</span>
                    {i < path.length - 1 && <span className="text-gray-300">/</span>}
                  </Fragment>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-gray-400 italic px-2">
            由于维度的值缺少，文件在当前视图不可见
          </div>
        )}

        <div className="mt-6 border-t border-gray-100 pt-4 flex flex-col gap-2">
          {(() => {
            const PREVIEW_SUPPORTED_TYPES = ['pdf', 'docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt'];
            const canPreview = selectedFile.url && PREVIEW_SUPPORTED_TYPES.includes(selectedFile.type.toLowerCase());
            
            const handlePreview = () => {
              if (!selectedFile.url) return;
              const nextParams = new URLSearchParams(searchParams);
              nextParams.set('preview', selectedFile.id);
              setSearchParams(nextParams);
            };

              const handleDownload = () => {
                if (!selectedFile.url) return;
                const baseUrl = window.location.origin;
                const fullUrl = selectedFile.url.startsWith('http') ? selectedFile.url : `${baseUrl}${selectedFile.url}`;
                
                const link = document.createElement('a');
                link.href = fullUrl;
                link.download = selectedFile.name || 'download';
                link.target = '_blank';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              };

              return (
                <div className="flex flex-col gap-2 w-full">
                  {canPreview && (
                    <button
                      onClick={handlePreview}
                      className="flex w-full items-center justify-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-600 transition-colors hover:bg-indigo-100"
                    >
                      <ExternalLink className="h-4 w-4" />
                      在线预览
                    </button>
                  )}
                  {selectedFile.url && (
                    <button
                      onClick={handleDownload}
                      className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 shadow-sm"
                    >
                      <Download className="h-4 w-4" />
                      下载文件
                    </button>
                  )}
                </div>
              );
            })()}
          <button
            onClick={() => onDeleteFile(selectedFile.id)}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-100"
          >
            <Trash2 className="h-4 w-4" />
            删除文件
          </button>
        </div>
      </div>
    </div>
  );
}
