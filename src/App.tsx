import { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Explorer } from './components/Explorer';
import { Inspector } from './components/Inspector';
import { DeleteFileModal } from './components/DeleteFileModal';
import { StatusToast } from './components/StatusToast';
import { UploadModal } from './components/UploadModal';
import { uploadFilesWithBackendSync } from './services/jetopApiService';
import { Management } from './components/Management';
import { UploadCloud } from 'lucide-react';
import { buildTree } from './lib/tree';
import { buildAvailableTagValues } from './lib/mock-data';
import type { FileItem, ActiveFilter } from './lib/types';
import { fileService } from './services/fileService';
import { preferenceService } from './services/preferenceService';

function App() {
  // 先用 LocalStorage 缓存数据初始化（同步，用于立即渲染）
  const [files, setFiles] = useState<FileItem[]>(() => fileService.getFiles());
  const [dimensionOrder, setDimensionOrder] = useState<string[]>(() => preferenceService.getDimensionOrder());
  const [currentPath, setCurrentPath] = useState<string[]>(() => preferenceService.getCurrentPath());
  const [selectedFileId, setSelectedFileId] = useState<string | null>(() => preferenceService.getSelectedFileId());
  
  const [isDragging, setIsDragging] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);
  const [uploadModalFiles, setUploadModalFiles] = useState<FileItem[]>([]);
  const [pendingBrowserFiles, setPendingBrowserFiles] = useState<File[]>([]);
  const [pendingDeleteFileId, setPendingDeleteFileId] = useState<string | null>(null);
  const [isDeletingFile, setIsDeletingFile] = useState(false);
  const [deleteFileError, setDeleteFileError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ title: string; message: string; tone: 'success' | 'error' } | null>(null);
  
  // View mode
  const [viewMode, setViewMode] = useState<'explorer' | 'management'>('explorer');
  
  // Search and Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);
  const [quickFilter, setQuickFilter] = useState("all");

  // 启动时异步从数据库初始化（自动写入种子数据）
  useEffect(() => {
    const initFromDb = async () => {
      try {
        console.log('[App] 正在从数据库初始化...');
        // 并行初始化文件 + 偏好
        const [dbFiles, dbPrefs] = await Promise.all([
          fileService.initFromDb(),
          preferenceService.initFromDb(),
        ]);

        // 更新状态
        setFiles(dbFiles);
        setDimensionOrder(dbPrefs.dimensionOrder);
        setCurrentPath(dbPrefs.currentPath);
        setSelectedFileId(dbPrefs.selectedFileId);
        console.log(`[App] 数据库初始化完成: ${dbFiles.length} 个文件`);
      } catch (error) {
        console.warn('[App] 数据库初始化失败，使用 LocalStorage 数据:', error);
      }
    };

    initFromDb();
  }, []);

  // Drag and drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    if (!e.dataTransfer.types || !e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    e.stopPropagation();
    setDragCounter(prev => prev + 1);
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.dataTransfer.types || !e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    e.stopPropagation();
    setDragCounter(prev => prev - 1);
    if (dragCounter - 1 === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!e.dataTransfer.types || !e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };

  const handleDrop = (e: React.DragEvent) => {
    if (!e.dataTransfer.types || !e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    setDragCounter(0);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFiles = Array.from(e.dataTransfer.files);
      setPendingBrowserFiles(droppedFiles);
      setUploadModalFiles(fileService.createUploadDrafts(droppedFiles, currentPath, dimensionOrder));
    }
  };

  // Validate current path when dimensions change
  useEffect(() => {
    setCurrentPath([]); 
    setSelectedFileId(null);
  }, [dimensionOrder]);

  // Clear selected file when global search/filter states change
  useEffect(() => {
    setSelectedFileId(null);
  }, [searchQuery, activeFilters, quickFilter]);

  // Sync to LocalStorage + 异步同步到数据库
  useEffect(() => {
    fileService.saveFiles(files);
  }, [files]);

  useEffect(() => {
    preferenceService.saveDimensionOrder(dimensionOrder);
  }, [dimensionOrder]);

  useEffect(() => {
    preferenceService.saveCurrentPath(currentPath);
  }, [currentPath]);

  useEffect(() => {
    preferenceService.saveSelectedFileId(selectedFileId);
  }, [selectedFileId]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const handleResetSystem = async () => {
    if (window.confirm('确定要重置整个文件系统并清空所有上传与修改的数据吗？')) {
      const resetPrefs = await preferenceService.resetPreferences();
      setFiles(fileService.resetFiles());
      setDimensionOrder(resetPrefs.dimensionOrder);
      setCurrentPath(resetPrefs.currentPath);
      setSelectedFileId(resetPrefs.selectedFileId);
    }
  };

  const rootFolder = buildTree(files, dimensionOrder);
  
  let currentFolder = rootFolder;
  let pathValid = true;

  for (const segment of currentPath) {
    if (currentFolder.subFolders[segment]) {
      currentFolder = currentFolder.subFolders[segment];
    } else {
      pathValid = false;
      break;
    }
  }

  // If path becomes invalid due to attribute changes or dimension changes
  if (!pathValid) {
    setCurrentPath([]);
    currentFolder = rootFolder;
  }

  const handleUpdateAttributes = (fileId: string, newAttrs: Record<string, string[]>) => {
    setFiles(prev => fileService.updateAttributes(prev, fileId, newAttrs));
  };

  const handleDeleteFile = async (fileId: string) => {
    setDeleteFileError(null);
    setPendingDeleteFileId(fileId);
  };

  const handleConfirmDeleteFile = async () => {
    if (!pendingDeleteFileId) return;

    try {
      setIsDeletingFile(true);
      await fileService.deleteFile(pendingDeleteFileId);
      setFiles(prev => prev.filter(file => file.id !== pendingDeleteFileId));
      if (selectedFileId === pendingDeleteFileId) {
        setSelectedFileId(null);
      }
      setPendingDeleteFileId(null);
      setDeleteFileError(null);
    } catch (error) {
      console.error('[App] 删除文件失败:', error);
      setDeleteFileError('删除失败，后端记录未能成功移除，请稍后重试。');
    } finally {
      setIsDeletingFile(false);
    }
  };

  const handleNavigatePath = (index: number) => {
    if (index === -1) {
      setCurrentPath([]);
    } else {
      setCurrentPath(currentPath.slice(0, index + 1));
    }
    setSelectedFileId(null);
  };

  const handleEnterFolder = (folderName: string) => {
    setCurrentPath([...currentPath, folderName]);
    setSelectedFileId(null);
  };

  const handleUploadConfirm = async (finalFiles: FileItem[]) => {
    setFiles(prev => [...prev, ...finalFiles]);
    setUploadModalFiles([]);

    // 完整流程：上传文件到 upload_json.ashx → 获取公网URL → 保存元数据（含Url）到后端
    if (pendingBrowserFiles.length > 0) {
      console.log('🚀 开始完整上传流程...');
      const result = await uploadFilesWithBackendSync(pendingBrowserFiles, finalFiles);
      if (result.success) {
        console.log('✅ 上传完成:', result.message);
        setToast({
          title: '上传成功',
          message: result.message,
          tone: 'success',
        });
      } else {
        console.warn('⚠️ 上传结果:', result.message);
        setToast({
          title: '上传未完成',
          message: result.message,
          tone: 'error',
        });
      }
      result.fileResults.forEach(r => {
        if (r.url) {
          console.log(`  📎 ${r.fileName} → ${r.url}`);
        }
      });
      setPendingBrowserFiles([]);
    }
  };

  const selectedFile = files.find(f => f.id === selectedFileId);

  return (
    <div 
      onDragEnter={handleDragEnter} 
      onDragLeave={handleDragLeave} 
      onDragOver={handleDragOver} 
      onDrop={handleDrop} 
      className="relative flex h-screen w-full bg-[#FBFBFA] font-sans text-primary overflow-hidden"
    >
      {isDragging && (
        <div className="absolute inset-x-4 inset-y-4 z-50 flex items-center justify-center bg-indigo-500/10 backdrop-blur-sm border-4 border-indigo-500 border-dashed rounded-3xl pointer-events-none transition-all">
          <div className="bg-white/90 backdrop-blur-md px-10 py-8 rounded-2xl shadow-2xl flex flex-col items-center pointer-events-none">
            <UploadCloud className="w-20 h-20 text-indigo-500 mb-4 animate-[bounce_1s_infinite]" />
            <h2 className="text-2xl font-bold text-gray-800">松开以上传文件</h2>
            <p className="text-gray-500 mt-2 font-medium">将智能继承当前视图的维度属性</p>
          </div>
        </div>
      )}

      {uploadModalFiles.length > 0 && (
        <UploadModal 
          files={uploadModalFiles} 
          dimensionOrder={dimensionOrder}
          availableTagValues={buildAvailableTagValues(files)}
          onCancel={() => {
            setUploadModalFiles([]);
            setPendingBrowserFiles([]);
          }}
          onConfirm={handleUploadConfirm}
        />
      )}

      {pendingDeleteFileId && (() => {
        const pendingDeleteFile = files.find(file => file.id === pendingDeleteFileId);
        if (!pendingDeleteFile) return null;

        return (
          <DeleteFileModal
            file={pendingDeleteFile}
            isDeleting={isDeletingFile}
            errorMessage={deleteFileError}
            onCancel={() => {
              if (isDeletingFile) return;
              setPendingDeleteFileId(null);
              setDeleteFileError(null);
            }}
            onConfirm={handleConfirmDeleteFile}
          />
        );
      })()}

      {toast && (
        <div className="pointer-events-none fixed right-6 top-6 z-[120]">
          <StatusToast
            title={toast.title}
            message={toast.message}
            tone={toast.tone}
            onClose={() => setToast(null)}
          />
        </div>
      )}

      {viewMode === 'explorer' ? (
        <>
          <Sidebar 
            dimensionOrder={dimensionOrder} 
            setDimensionOrder={setDimensionOrder} 
            onReset={handleResetSystem}
            onOpenManagement={() => setViewMode('management')}
          />
          <Explorer 
            currentFolder={currentFolder} 
            currentPath={currentPath}
            dimensionOrder={dimensionOrder}
            navigatePath={handleNavigatePath}
            enterFolder={handleEnterFolder}
            selectedFileId={selectedFileId}
            onSelectFile={setSelectedFileId}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            activeFilters={activeFilters}
            setActiveFilters={setActiveFilters}
            quickFilter={quickFilter}
            setQuickFilter={setQuickFilter}
          />
          <Inspector 
            selectedFile={selectedFile}
            allFiles={files}
            dimensionOrder={dimensionOrder}
            onUpdateAttributes={handleUpdateAttributes}
            onDeleteFile={handleDeleteFile}
            onClose={() => setSelectedFileId(null)}
          />
        </>
      ) : (
        <Management 
          files={files}
          setFiles={setFiles}
          onClose={() => setViewMode('explorer')}
        />
      )}
    </div>
  );
}

export default App;
