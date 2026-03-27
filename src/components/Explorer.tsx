import { ChevronRight, Folder, File as FileIcon, FileText, Image, FileSpreadsheet, Presentation, Search, X, Tag } from 'lucide-react';
import { useState } from 'react';
import type { VirtualFolder, ActiveFilter } from '../lib/types';
import { cn } from '../lib/utils';
import { getAllFilesInFolder } from '../lib/tree';
import { Fragment } from 'react';

interface ExplorerProps {
  currentFolder: VirtualFolder;
  currentPath: string[];
  dimensionOrder: string[];
  navigatePath: (index: number) => void;
  enterFolder: (folderName: string) => void;
  selectedFileId: string | null;
  onSelectFile: (id: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  activeFilters: ActiveFilter[];
  setActiveFilters: (filters: ActiveFilter[]) => void;
  quickFilter: string;
  setQuickFilter: (filter: string) => void;
}

export function Explorer({ 
  currentFolder, 
  currentPath, 
  dimensionOrder, 
  navigatePath, 
  enterFolder, 
  selectedFileId, 
  onSelectFile,
  searchQuery,
  setSearchQuery,
  activeFilters,
  setActiveFilters,
  quickFilter,
  setQuickFilter
}: ExplorerProps) {
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // normal view data
  const folders = Object.values(currentFolder.subFolders);
  // get files locally at leaf if not searching
  const files = currentFolder.files;

  // omni search and filter logic
  const isSearchMode = searchQuery.trim().length > 0 || activeFilters.length > 0 || quickFilter !== 'all';
  const allFolderFiles = getAllFilesInFolder(currentFolder);

  // Suggestions map
  const attributeMap = new Map<string, Set<string>>();
  allFolderFiles.forEach(f => {
    Object.entries(f.attributes).forEach(([dim, vals]) => {
      if (!attributeMap.has(dim)) attributeMap.set(dim, new Set());
      vals.forEach(v => attributeMap.get(dim)!.add(v));
    });
  });

  const suggestions: ActiveFilter[] = [];
  if (searchQuery.trim().length > 0) {
    const query = searchQuery.toLowerCase();
    attributeMap.forEach((vals, dim) => {
      vals.forEach(v => {
        if (v.toLowerCase().includes(query) || dim.toLowerCase().includes(query)) {
          suggestions.push({ dimension: dim, value: v });
        }
      });
    });
  }

  // File filtering
  let displayFiles = files; // Default to path leaf files
  if (isSearchMode) {
    let tempFiles = allFolderFiles;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      tempFiles = tempFiles.filter(f => f.name.toLowerCase().includes(q));
    }

    if (activeFilters.length > 0) {
      tempFiles = tempFiles.filter(f => {
        return activeFilters.every(af => {
          const fileVals = f.attributes[af.dimension];
          return fileVals && fileVals.includes(af.value);
        });
      });
    }

    if (quickFilter === 'recent') {
      const now = new Date();
      tempFiles = tempFiles.filter(f => {
         const fd = new Date(f.updatedAt);
         return (now.getTime() - fd.getTime()) < 7 * 24 * 60 * 60 * 1000;
      });
    } else if (quickFilter === 'uncategorized') {
      tempFiles = tempFiles.filter(f => Object.keys(f.attributes).every(k => f.attributes[k].length === 0));
    } else if (quickFilter === 'large') {
      tempFiles = tempFiles.filter(f => f.size > 5 * 1024 * 1024);
    }

    displayFiles = tempFiles;
  }

  const getIconForType = (type: string) => {
    switch (type) {
      case 'pdf': return <FileText className="w-6 h-6 text-red-500" />;
      case 'xlsx': return <FileSpreadsheet className="w-6 h-6 text-green-600" />;
      case 'docx': return <FileText className="w-6 h-6 text-blue-600" />;
      case 'pptx': return <Presentation className="w-6 h-6 text-orange-500" />;
      case 'fig': return <Image className="w-6 h-6 text-purple-500" />;
      case 'md': return <FileText className="w-6 h-6 text-gray-600" />;
      default: return <FileIcon className="w-6 h-6 text-gray-400" />;
    }
  };

  const getFolderColorStyles = (dimension: string) => {
    switch (dimension) {
      case '部门': return { text: 'text-blue-500', fill: 'fill-blue-100', bg: 'bg-blue-50', border: 'border-blue-200' };
      case '密级': return { text: 'text-amber-500', fill: 'fill-amber-100', bg: 'bg-amber-50', border: 'border-amber-200' };
      case '年份': return { text: 'text-green-500', fill: 'fill-green-100', bg: 'bg-green-50', border: 'border-green-200' };
      case '项目': return { text: 'text-purple-500', fill: 'fill-purple-100', bg: 'bg-purple-50', border: 'border-purple-200' };
      case '文件类型': return { text: 'text-rose-500', fill: 'fill-rose-100', bg: 'bg-rose-50', border: 'border-rose-200' };
      default: return { text: 'text-gray-500', fill: 'fill-gray-100', bg: 'bg-gray-50', border: 'border-gray-200' };
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (isoStr: string) => {
    const d = new Date(isoStr);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex-1 bg-white flex flex-col h-full overflow-hidden relative">
      {/* Breadcrumbs */}
      <div className="h-14 border-b border-border flex items-center px-6 text-sm shrink-0">
        <button 
          onClick={() => navigatePath(-1)}
          className="hover:bg-accent px-2 py-1 rounded text-text-secondary hover:text-primary transition-colors font-medium"
        >
          全部
        </button>
        {currentPath.map((segment, idx) => (
          <Fragment key={idx}>
            <ChevronRight className="w-4 h-4 mx-1 text-gray-300" />
            <button 
              onClick={() => navigatePath(idx)}
              className="hover:bg-accent px-2 py-1 rounded text-primary transition-colors flex items-center gap-1.5"
            >
              <span className="text-gray-400 text-xs font-medium bg-gray-100 px-1.5 py-0.5 rounded">{dimensionOrder[idx]}</span>
              <span className="font-medium">{segment}</span>
            </button>
          </Fragment>
        ))}
      </div>

      {/* Omnisearch Bar */}
      <div className="px-6 pt-6 pb-2 shrink-0 relative">
        <div className="relative flex items-center bg-white border border-border rounded-full px-4 py-3 shadow-sm focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 transition-all">
          <Search className="w-5 h-5 text-gray-400 mr-2 shrink-0" />
          
          <div className="flex items-center flex-wrap gap-2 overflow-x-auto no-scrollbar max-w-[60%] shrink-0">
            {activeFilters.map((af, idx) => (
              <div key={idx} className="flex items-center bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-xs font-medium shrink-0 animate-in fade-in zoom-in duration-200">
                <span className="opacity-60 mr-1.5 font-normal">{af.dimension}:</span>
                <span>{af.value}</span>
                <button 
                  onClick={() => setActiveFilters(activeFilters.filter((_, i) => i !== idx))} 
                  className="ml-2 hover:bg-indigo-200/50 rounded-full p-0.5 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          <input 
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
            placeholder={activeFilters.length === 0 ? "搜索文件名称或特定属性..." : ""}
            className="flex-1 outline-none bg-transparent placeholder-gray-400 text-sm min-w-[150px] ml-2"
          />
        </div>

        {/* Auto-suggestions dropdown */}
        {isSearchFocused && searchQuery && suggestions.length > 0 && (
          <div className="absolute top-[76px] left-6 right-6 bg-white border border-gray-200 rounded-xl shadow-lg z-50 py-2 max-h-60 overflow-y-auto animate-in slide-in-from-top-2 fade-in">
            <div className="px-5 py-2 text-xs font-medium text-gray-400 uppercase tracking-wider">推荐属性标签</div>
            {suggestions.map((s, idx) => (
               <button 
                 key={idx}
                 className="w-full text-left px-5 py-2.5 hover:bg-indigo-50 flex items-center text-sm transition-colors group"
                 onClick={() => {
                    if (!activeFilters.find(f => f.dimension === s.dimension && f.value === s.value)) {
                      setActiveFilters([...activeFilters, s]);
                    }
                    setSearchQuery("");
                 }}
               >
                 <div className="bg-indigo-100 p-1 rounded-md mr-3 group-hover:bg-indigo-200 transition-colors">
                   <Tag className="w-4 h-4 text-indigo-600" />
                 </div>
                 <span className="text-gray-500 mr-1.5">{s.dimension}:</span> 
                 <span className="font-semibold text-gray-800">{s.value}</span>
               </button>
            ))}
          </div>
        )}

        <div className="flex bg-transparent mt-4 gap-2 overflow-x-auto no-scrollbar pb-2">
           <button onClick={() => setQuickFilter('all')} className={cn("px-4 py-1.5 rounded-full text-xs font-medium transition-all shrink-0 border", quickFilter === 'all' ? "bg-gray-800 text-white border-gray-800 shadow-sm" : "bg-white text-gray-600 border-border hover:bg-gray-50 hover:border-gray-300")}>全部相关</button>
           <button onClick={() => setQuickFilter('recent')} className={cn("px-4 py-1.5 rounded-full text-xs font-medium transition-all shrink-0 border", quickFilter === 'recent' ? "bg-gray-800 text-white border-gray-800 shadow-sm" : "bg-white text-gray-600 border-border hover:bg-gray-50 hover:border-gray-300")}>最近七天</button>
           <button onClick={() => setQuickFilter('uncategorized')} className={cn("px-4 py-1.5 rounded-full text-xs font-medium transition-all shrink-0 border", quickFilter === 'uncategorized' ? "bg-gray-800 text-white border-gray-800 shadow-sm" : "bg-white text-gray-600 border-border hover:bg-gray-50 hover:border-gray-300")}>未分类文件</button>
           <button onClick={() => setQuickFilter('large')} className={cn("px-4 py-1.5 rounded-full text-xs font-medium transition-all shrink-0 border", quickFilter === 'large' ? "bg-gray-800 text-white border-gray-800 shadow-sm" : "bg-white text-gray-600 border-border hover:bg-gray-50 hover:border-gray-300")}>大文件 ({'>'}5MB)</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {/* Render Folders only if NOT in Search Mode */}
        {!isSearchMode && folders.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 mb-8">
            {folders.map(folder => {
              const colors = getFolderColorStyles(folder.dimension);
              const totalFiles = getAllFilesInFolder(folder).length;
              
              return (
                <div 
                  key={folder.name}
                  onClick={() => enterFolder(folder.name)}
                  className={cn("flex flex-col gap-3 p-4 rounded-xl border cursor-pointer transition-all shadow-sm hover:shadow", colors.bg, colors.border)}
                >
                  <div className="flex items-center gap-3">
                    <Folder className={cn("w-8 h-8", colors.text, colors.fill)} />
                    <div className="flex flex-col overflow-hidden">
                      <span className="font-medium text-sm truncate text-primary">{folder.name}</span>
                      <span className="text-xs text-text-secondary">{folder.dimension}分类</span>
                    </div>
                  </div>
                  <div className="text-xs text-text-secondary font-medium pt-1 mt-auto border-t border-black/5 flex justify-end">
                    共 {totalFiles} 个文件
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Empty States */}
        {!isSearchMode && folders.length === 0 && displayFiles.length === 0 && (
          <div className="text-center text-text-secondary mt-20 flex flex-col items-center">
            <Folder className="w-16 h-16 text-gray-200 mb-4" />
            <p>该视图下暂无文件或文件夹</p>
          </div>
        )}

        {isSearchMode && displayFiles.length === 0 && (
          <div className="text-center text-text-secondary mt-24 flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mb-6">
              <Search className="w-10 h-10 text-gray-300" />
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">未找到匹配的文件</h3>
            <p className="text-gray-500 max-w-sm">找不到符合当前过滤条件的文件。请尝试减少属性标签或更改搜索关键词。</p>
            {activeFilters.length > 0 && (
              <button 
                onClick={() => { setActiveFilters([]); setSearchQuery(''); setQuickFilter('all'); }}
                className="mt-6 px-5 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-full text-sm font-medium transition-colors shadow-sm"
              >
                清除所有过滤条件
              </button>
            )}
          </div>
        )}

        {/* File List */}
        {displayFiles.length > 0 && (
          <div className={cn("mt-2", isSearchMode ? "mt-0" : "")}>
            <div className="flex items-center justify-between border-b border-border pb-3 mb-4 sticky top-0 bg-white z-10 pt-2">
              <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
                 {isSearchMode ? '搜索结果' : '文件'} ({displayFiles.length})
              </h3>
            </div>
            <div className="bg-white rounded-xl border border-border overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-[#FBFBFA] border-b border-border text-text-secondary">
                    <th className="font-medium p-3 px-5">名称</th>
                    <th className="font-medium p-3 px-5 w-32">大小</th>
                    <th className="font-medium p-3 px-5 w-48">修改时间</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {displayFiles.map(file => (
                    <tr 
                      key={file.id} 
                      onClick={() => onSelectFile(file.id)}
                      className={cn(
                        "hover:bg-accent cursor-pointer transition-colors",
                        selectedFileId === file.id ? "bg-indigo-50/50 hover:bg-indigo-50" : ""
                      )}
                    >
                      <td className="p-3 px-5 flex flex-col gap-1.5 py-4">
                        <div className="flex items-center gap-3">
                          {getIconForType(file.type)}
                          <span className={cn("font-medium", selectedFileId === file.id ? "text-indigo-700 font-semibold" : "")}>
                            {file.name}
                          </span>
                        </div>
                        {isSearchMode && (
                          <div className="flex flex-wrap gap-1.5 ml-9 mt-0.5">
                            {Object.entries(file.attributes)
                              .filter(([_, vals]) => vals && vals.length > 0)
                              .map(([dim, vals]) => 
                                vals.map(v => (
                                  <span key={`${dim}-${v}`} className="text-[10px] bg-gray-100/80 border border-gray-200/60 text-gray-600 px-2 py-0.5 rounded-md font-medium">
                                    <span className="opacity-70 font-normal mr-1">{dim}:</span>{v}
                                  </span>
                                ))
                              )}
                          </div>
                        )}
                      </td>
                      <td className="p-3 px-5 text-text-secondary">{formatSize(file.size)}</td>
                      <td className="p-3 px-5 text-text-secondary">{formatDate(file.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
