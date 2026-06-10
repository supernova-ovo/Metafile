import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { Explorer } from './components/Explorer';
import { Inspector } from './components/Inspector';
import { DeleteFileModal } from './components/DeleteFileModal';
import { StatusToast } from './components/StatusToast';
import { UploadModal } from './components/UploadModal';
import { Management } from './components/Management';
import { Loader2, UploadCloud } from 'lucide-react';
import { buildAvailableTagValues } from './lib/mock-data';
import type { FileItem, ActiveFilter } from './lib/types';
import { fileService } from './services/fileService';
import { preferenceService } from './services/preferenceService';
import * as apiService from './services/apiService';
import type { DimRow } from './services/apiService';
import { availableDimensions as mockAvailableDimensions } from './lib/mock-data';
import { useFileStore } from './store/useFileStore';
import { selectVirtualTree } from './store/selectors';
import { ErrorBoundary } from './components/core/ErrorBoundary';
import { JobQueueOverlay } from './components/core/JobQueueOverlay';
import { PreviewModal } from './components/core/PreviewModal';
import { useJobStore } from './store/useJobStore';
import { jobQueue } from './services/jobQueue';

function App() {
  const storeFiles = useFileStore(state => state.files);
  const files = Object.values(storeFiles);
  const setFiles = useFileStore(state => state.setFiles);
  const addFiles = useFileStore(state => state.addFiles);
  const updateFileAttributes = useFileStore(state => state.updateFileAttributes);
  const deleteFile = useFileStore(state => state.deleteFile);
  const resetFilesAction = useFileStore(state => state.resetFiles);
  const hydrateFileAttributes = useFileStore(state => state.hydrateFileAttributes);

  const [dimensionOrder, setDimensionOrder] = useState<string[]>(() => preferenceService.getDimensionOrder());
  const [currentPath, setCurrentPath] = useState<string[]>(() => preferenceService.getCurrentPath());
  const [selectedFileId, setSelectedFileId] = useState<string | null>(() => preferenceService.getSelectedFileId());
  const [dimensions, setDimensions] = useState<DimRow[]>(
    mockAvailableDimensions.map(d => ({ sys_id: d, WHMC: d, WHMS: d }))
  );
  
  const availableDimensions = dimensions.map(d => d.WHMC);
  
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
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);
  const [quickFilter, setQuickFilter] = useState("all");
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const isBootstrappingRef = useRef(true);
  const hasInitRunRef = useRef(false);

  // 启动时异步从数据库初始化（自动写入种子数据）
  useEffect(() => {
    if (hasInitRunRef.current) return;
    hasInitRunRef.current = true;

    const initFromDb = async () => {
      try {
        // console.log('[App] 正在从数据库初始化...');
        // 并行初始化文件 + 偏好 + 维度
        const [dbFiles, dbPrefs, dbDims] = await Promise.all([
          fileService.initFromDb(),
          preferenceService.initFromDb(),
          apiService.queryAllDimensions(),
        ]);

        // 更新状态
        setFiles(dbFiles);
        setDimensionOrder(dbPrefs.dimensionOrder);
        setCurrentPath(dbPrefs.currentPath);
        setSelectedFileId(dbPrefs.selectedFileId);
        if (dbDims.length > 0) {
          setDimensions(dbDims);
        } else {
          // If DB is totally empty, we might want to fallback to mock just for UI, but let's sync real dbDims
          setDimensions(dbDims);
        }
        // console.log(`[App] 数据库初始化完成: ${dbFiles.length} 个文件, ${dbDims.length} 个维度`);
      } catch (error) {
        console.warn('[App] 数据库初始化失败，使用 LocalStorage 数据:', error);
      }
    };

    initFromDb().finally(() => {
      isBootstrappingRef.current = false;
      setIsBootstrapping(false);
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

  // Skip local sync effect since Zustand store actions already handle it.
  // We keep the skip flag logic for things that bypass the store DB sync.

  useEffect(() => {
    if (isBootstrappingRef.current) return;
    if (!selectedFileId) return;
    let cancelled = false;

    void (async () => {
      if (cancelled) return;
      await hydrateFileAttributes(selectedFileId);
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedFileId, hydrateFileAttributes]);

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
      resetFilesAction();
      setDimensionOrder(resetPrefs.dimensionOrder);
      setCurrentPath(resetPrefs.currentPath);
      setSelectedFileId(resetPrefs.selectedFileId);
    }
  };

  const rootFolder = selectVirtualTree(useFileStore.getState(), dimensionOrder);

  // 构建当前文件夹
  // 修复：不再因"目录变空"就跳回根目录。
  // 只有当路径层级超过 dimensionOrder 深度时（维度被删减），才重置路径。
  // 若某一层的目录不存在（文件都被移走标签），则停留在能到达的最深父级，显示空目录状态。
  let currentFolder = rootFolder;
  const validPathSegments: string[] = [];
  for (const segment of currentPath) {
    if (currentFolder.subFolders[segment]) {
      currentFolder = currentFolder.subFolders[segment];
      validPathSegments.push(segment);
    } else {
      // 该层目录已不存在（标签变更导致目录变空），停在此父级
      break;
    }
  }

  // 自动修正失效的路径状态，防止后续点击文件夹时路径无限嵌套
  const validPathString = validPathSegments.join('/');
  const currentPathString = currentPath.join('/');
  useEffect(() => {
    if (validPathString !== currentPathString) {
      setCurrentPath(validPathSegments);
    }
  }, [validPathString, currentPathString]);

  const handleUpdateAttributes = (fileId: string, newAttrs: Record<string, string[]>) => {
    updateFileAttributes(fileId, newAttrs);
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
      deleteFile(pendingDeleteFileId);
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

  const handleFilesChangeWithoutSync = (nextFiles: FileItem[]) => {
    setFiles(nextFiles, true);
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
    // Add to FileStore immediately (optimistic update)
    addFiles(finalFiles, true);
    setUploadModalFiles([]);

    if (pendingBrowserFiles.length > 0) {
      // Create jobs
      const jobs = pendingBrowserFiles.map((file, index) => {
        const meta = finalFiles[index];
        return {
          id: meta.id,
          file,
          meta,
          status: 'pending' as const,
          progress: 0,
        };
      });

      // Push to JobStore
      useJobStore.getState().addJobs(jobs);

      // Start jobs asynchronously (non-blocking)
      jobs.forEach(job => {
        jobQueue.startJob(job.id);
      });

      setToast({
        title: '已加入上传队列',
        message: `共有 ${jobs.length} 个文件正在后台上传并同步...`,
        tone: 'success',
      });
      
      setPendingBrowserFiles([]);
    }
  };

  const selectedFile = files.find(f => f.id === selectedFileId);

  if (isBootstrapping) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#FBFBFA] font-sans text-primary">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
          <div className="text-sm font-medium text-gray-700">正在加载文件视图...</div>
        </div>
      </div>
    );
  }

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
          availableDimensions={availableDimensions}
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

      {searchParams.get('preview') && (
        <PreviewModal 
          fileId={searchParams.get('preview')!} 
          onClose={() => {
            const nextParams = new URLSearchParams(searchParams);
            nextParams.delete('preview');
            setSearchParams(nextParams);
          }} 
        />
      )}

      <JobQueueOverlay />

      {viewMode === 'explorer' ? (
        <>
          <Sidebar 
            dimensionOrder={dimensionOrder} 
            setDimensionOrder={setDimensionOrder} 
            availableDimensions={availableDimensions}
            onReset={handleResetSystem}
            onOpenManagement={() => setViewMode('management')}
          />
          <ErrorBoundary>
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
          </ErrorBoundary>
          <ErrorBoundary>
            <Inspector 
              selectedFile={selectedFile}
              allFiles={files}
              dimensionOrder={dimensionOrder}
              availableDimensions={availableDimensions}
              onUpdateAttributes={handleUpdateAttributes}
              onDeleteFile={handleDeleteFile}
              onClose={() => setSelectedFileId(null)}
            />
          </ErrorBoundary>
        </>
      ) : (
        <Management 
          files={files}
          setFiles={setFiles}
          onFilesChangeWithoutSync={handleFilesChangeWithoutSync}
          dimensions={dimensions}
          setDimensions={setDimensions}
          onClose={() => setViewMode('explorer')}
        />
      )}
    </div>
  );
}

export default App;
