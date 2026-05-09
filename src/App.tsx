import { useState, useEffect, useRef } from 'react';
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
  const isBootstrappingRef = useRef(true);
  const hasInitRunRef = useRef(false);
  const skipNextDbSyncRef = useRef(false);
  const isHydratingAttrsRef = useRef(false);

  // 启动时异步从数据库初始化（自动写入种子数据）
  useEffect(() => {
    if (hasInitRunRef.current) return;
    hasInitRunRef.current = true;

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

    initFromDb().finally(() => {
      isBootstrappingRef.current = false;
    });
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

  // 当维度顺序变更时重置路径（维度结构变化，路径失效）
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
    if (isBootstrappingRef.current) return;
    if (skipNextDbSyncRef.current) {
      fileService.saveFiles(files, { skipDbSync: true });
      skipNextDbSyncRef.current = false;
      return;
    }
    if (isHydratingAttrsRef.current) {
      fileService.saveFiles(files, { skipDbSync: true });
      isHydratingAttrsRef.current = false;
      return;
    }
    fileService.saveFiles(files);
  }, [files]);

  useEffect(() => {
    if (isBootstrappingRef.current) return;
    if (!selectedFileId) return;
    let cancelled = false;

    void (async () => {
      const next = await fileService.hydrateFileAttributes(files, selectedFileId);
      if (cancelled) return;
      if (next !== files) {
        isHydratingAttrsRef.current = true;
        setFiles(next);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedFileId, files]);

  useEffect(() => {
    if (isBootstrappingRef.current) return;
    preferenceService.saveDimensionOrder(dimensionOrder);
  }, [dimensionOrder]);

  useEffect(() => {
    if (isBootstrappingRef.current) return;
    preferenceService.saveCurrentPath(currentPath);
  }, [currentPath]);

  useEffect(() => {
    if (isBootstrappingRef.current) return;
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

  // 构建当前文件夹
  // 修复：不再因"目录变空"就跳回根目录。
  // 只有当路径层级超过 dimensionOrder 深度时（维度被删减），才重置路径。
  // 若某一层的目录不存在（文件都被移走标签），则停留在能到达的最深父级，显示空目录状态。
  let currentFolder = rootFolder;
  for (const segment of currentPath) {
    if (currentFolder.subFolders[segment]) {
      currentFolder = currentFolder.subFolders[segment];
    } else {
      // 该层目录已不存在（标签变更导致目录变空），停在此父级
      break;
    }
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
    // 上传流程会单独调用 uploadFilesWithBackendSync 写主表，避免重复触发自动全量写库。
    skipNextDbSyncRef.current = pendingBrowserFiles.length > 0;
    setFiles(prev => [...prev, ...finalFiles]);
    setUploadModalFiles([]);

    // 完整流程：上传文件到 upload_json.ashx → 获取公网URL → 保存元数据（含Url）到后端
    if (pendingBrowserFiles.length > 0) {
      console.log('🚀 开始完整上传流程...');
      const result = await uploadFilesWithBackendSync(pendingBrowserFiles, finalFiles);
      if (result.success) {
        await fileService.syncUploadedAttributes(finalFiles);
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
