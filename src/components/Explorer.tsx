
import { ChevronRight, Folder, File as FileIcon, FileText, Image, FileSpreadsheet, Presentation } from 'lucide-react';
import type { VirtualFolder } from '../lib/types';
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
}

export function Explorer({ currentFolder, currentPath, dimensionOrder, navigatePath, enterFolder, selectedFileId, onSelectFile }: ExplorerProps) {
  const folders = Object.values(currentFolder.subFolders);
  // Get files natively in this folder (at the leaf of dimensions)
  const files = currentFolder.files;
  
  // If we want to show all files in current view when not at leaf, we can optionally get them:
  // But let's show leaf files normally
  
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
    <div className="flex-1 bg-white flex flex-col h-full overflow-hidden">
      {/* Breadcrumbs */}
      <div className="h-14 border-b border-border flex items-center px-6 text-sm">
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

      <div className="flex-1 overflow-y-auto p-6">
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

        {folders.length === 0 && files.length === 0 && (
          <div className="text-center text-text-secondary mt-20 flex flex-col items-center">
            <Folder className="w-16 h-16 text-gray-200 mb-4" />
            <p>该视图下暂无文件或文件夹</p>
          </div>
        )}

        {files.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4 border-b border-border pb-2">
              文件 ({files.length})
            </h3>
            <div className="bg-white rounded-lg border border-border overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-[#FBFBFA] border-b border-border text-text-secondary">
                    <th className="font-medium p-3 px-4">名称</th>
                    <th className="font-medium p-3 px-4 w-32">大小</th>
                    <th className="font-medium p-3 px-4 w-48">修改时间</th>
                  </tr>
                </thead>
                <tbody>
                  {files.map(file => (
                    <tr 
                      key={file.id} 
                      onClick={() => onSelectFile(file.id)}
                      className={cn(
                        "border-b border-border/50 last:border-0 hover:bg-accent cursor-pointer transition-colors",
                        selectedFileId === file.id ? "bg-indigo-50 hover:bg-indigo-50" : ""
                      )}
                    >
                      <td className="p-3 px-4 flex items-center gap-3">
                        {getIconForType(file.type)}
                        <span className={cn("font-medium", selectedFileId === file.id ? "text-indigo-700" : "")}>
                          {file.name}
                        </span>
                      </td>
                      <td className="p-3 px-4 text-text-secondary">{formatSize(file.size)}</td>
                      <td className="p-3 px-4 text-text-secondary">{formatDate(file.updatedAt)}</td>
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
