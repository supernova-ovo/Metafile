import { ChevronRight, Folder, File as FileIcon, FileText, Image, FileSpreadsheet, Presentation, Search, X, Tag } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { VirtualFolder, ActiveFilter } from '../lib/types';
import { cn } from '../lib/utils';
import { getAllFilesInFolder } from '../lib/tree';
import { Fragment, useMemo } from 'react';
import { useFileStore } from '../store/useFileStore';
import { selectFilteredFiles } from '../store/selectors';
import { RenameFileName } from './RenameFileName';

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

const YEAR_DIMENSION_PATTERN = /(年份|年度|年$)/;
const YEAR_VALUE_PATTERN = /(19|20)\d{2}/;

const extractYearValue = (value: string) => {
  const match = value.match(YEAR_VALUE_PATTERN);
  return match ? Number(match[0]) : null;
};

const isYearDimensionFolder = (folder: VirtualFolder) => YEAR_DIMENSION_PATTERN.test(folder.dimension);

const getDisplayFolders = (subFolders: Record<string, VirtualFolder>) => {
  const folders = Object.values(subFolders);
  if (!folders.some(isYearDimensionFolder)) return folders;

  return folders
    .map((folder, index) => ({ folder, index }))
    .sort((a, b) => {
      const yearA = extractYearValue(a.folder.name);
      const yearB = extractYearValue(b.folder.name);

      if (yearA !== null && yearB !== null && yearA !== yearB) return yearB - yearA;
      if (yearA !== null && yearB === null) return -1;
      if (yearA === null && yearB !== null) return 1;
      return a.index - b.index;
    })
    .map(({ folder }) => folder);
};

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
  const [searchParams, setSearchParams] = useSearchParams();

  const storeState = useFileStore();

  // normal view data
  const folders = useMemo(() => getDisplayFolders(currentFolder.subFolders), [currentFolder.subFolders]);
  // get files locally at leaf if not searching
  const files = currentFolder.files;

  // omni search and filter logic
  const isSearchMode = searchQuery.trim().length > 0 || activeFilters.length > 0 || quickFilter !== 'all';
  
  const allFolderFiles = useMemo(() => getAllFilesInFolder(currentFolder), [currentFolder]);

  // Suggestions map optimized with useMemo
  const suggestions = useMemo(() => {
    if (searchQuery.trim().length === 0) return [];
    
    const attributeMap = new Map<string, Set<string>>();
    allFolderFiles.forEach(f => {
      Object.entries(f.attributes).forEach(([dim, vals]) => {
        if (!attributeMap.has(dim)) attributeMap.set(dim, new Set());
        vals.forEach(v => attributeMap.get(dim)!.add(v));
      });
    });

    const result: ActiveFilter[] = [];
    const query = searchQuery.toLowerCase();
    attributeMap.forEach((vals, dim) => {
      vals.forEach(v => {
        if (v.toLowerCase().includes(query) || dim.toLowerCase().includes(query)) {
          result.push({ dimension: dim, value: v });
        }
      });
    });
    return result;
  }, [allFolderFiles, searchQuery]);

  // File filtering optimized with useMemo and selectors
  const displayFiles = useMemo(() => {
    if (!isSearchMode) return files;
    return selectFilteredFiles(storeState, allFolderFiles, searchQuery, activeFilters, quickFilter);
  }, [storeState, allFolderFiles, files, isSearchMode, searchQuery, activeFilters, quickFilter]);

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
    const knownColors: Record<string, { text: string; fill: string; bg: string; border: string }> = {
      部门: { text: 'text-blue-500', fill: 'fill-blue-100', bg: 'bg-blue-50', border: 'border-blue-200' },
      密级: { text: 'text-amber-500', fill: 'fill-amber-100', bg: 'bg-amber-50', border: 'border-amber-200' },
      年份: { text: 'text-green-500', fill: 'fill-green-100', bg: 'bg-green-50', border: 'border-green-200' },
      项目: { text: 'text-purple-500', fill: 'fill-purple-100', bg: 'bg-purple-50', border: 'border-purple-200' },
      档案类别: { text: 'text-indigo-500', fill: 'fill-indigo-100', bg: 'bg-indigo-50', border: 'border-indigo-200' },
      档案分类: { text: 'text-cyan-600', fill: 'fill-cyan-100', bg: 'bg-cyan-50', border: 'border-cyan-200' },
      状态: { text: 'text-emerald-600', fill: 'fill-emerald-100', bg: 'bg-emerald-50', border: 'border-emerald-200' },
      文件类型: { text: 'text-rose-500', fill: 'fill-rose-100', bg: 'bg-rose-50', border: 'border-rose-200' },
    };

    if (knownColors[dimension]) return knownColors[dimension];
    if (dimension.includes('项目')) return knownColors.项目;
    if (dimension.includes('类型') || dimension.includes('分类')) return knownColors.档案分类;
    if (dimension.includes('时间') || dimension.includes('年份')) return knownColors.年份;
    if (dimension.includes('文件')) return knownColors.文件类型;

    const fallbackColors = [
      knownColors.部门,
      knownColors.密级,
      knownColors.年份,
      knownColors.项目,
      knownColors.档案类别,
      knownColors.档案分类,
      knownColors.状态,
      knownColors.文件类型,
    ];
    const hash = Array.from(dimension).reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return fallbackColors[hash % fallbackColors.length];
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

      <div className="flex-1 overflow-y-auto px-6 pb-6 pt-4">
        {/* Render Folders only if NOT in Search Mode */}
        {!isSearchMode && folders.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-5 mb-8">
            {folders.map(folder => {
              const colors = getFolderColorStyles(folder.dimension);
              const totalFiles = getAllFilesInFolder(folder).length;
              const subFolderCount = Object.keys(folder.subFolders).length;
              
              return (
                <div 
                  key={folder.name}
                  onClick={() => enterFolder(folder.name)}
                  className={cn(
                    "flex min-h-[148px] flex-col gap-3 rounded-2xl border p-5 cursor-pointer transition-all shadow-sm hover:shadow-md",
                    colors.bg,
                    colors.border
                  )}
                >
                  <div className="flex items-start gap-4">
                    <div className={cn("rounded-2xl p-3 shadow-sm bg-white/75 border border-white/80", colors.border)}>
                      <Folder className={cn("w-9 h-9 shrink-0", colors.text, colors.fill)} />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="mb-2 flex items-center gap-2">
                        <span className="rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-text-secondary border border-black/5">
                          {folder.dimension} 分类
                        </span>
                        <span className="rounded-full bg-white/60 px-2.5 py-1 text-[11px] font-medium text-text-secondary border border-black/5">
                          第 {currentPath.length + 1} 层
                        </span>
                      </div>
                      <span className="font-semibold text-[15px] leading-6 text-primary break-words line-clamp-2">
                        {folder.name}
                      </span>
                      <span className="mt-1 text-[11px] text-text-secondary">
                        点击进入查看该目录下的文件与子目录
                      </span>
                    </div>
                  </div>

                  <div className="mt-auto flex flex-wrap gap-2 border-t border-black/5 pt-3">
                    <div className="rounded-xl bg-white/80 px-3 py-2 text-xs text-text-secondary border border-black/5">
                      <span className="font-semibold text-primary">{totalFiles}</span> 个文件
                    </div>
                    <div className="rounded-xl bg-white/80 px-3 py-2 text-xs text-text-secondary border border-black/5">
                      <span className="font-semibold text-primary">{subFolderCount}</span> 个子目录
                    </div>
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
                      onDoubleClick={() => {
                        const nextParams = new URLSearchParams(searchParams);
                        nextParams.set('preview', file.id);
                        setSearchParams(nextParams);
                      }}
                      className={cn(
                        "hover:bg-accent cursor-pointer transition-colors",
                        selectedFileId === file.id ? "bg-indigo-50/50 hover:bg-indigo-50" : ""
                      )}
                    >
                      <td className="p-3 px-5 flex flex-col gap-1.5 py-4">
                        <div className="flex items-center gap-3">
                          {getIconForType(file.type)}
                          <RenameFileName
                            file={file}
                            siblingFiles={displayFiles}
                            className="flex-1"
                            textClassName={cn("font-medium", selectedFileId === file.id ? "text-indigo-700 font-semibold" : "")}
                            onStartEdit={() => onSelectFile(file.id)}
                          />
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
