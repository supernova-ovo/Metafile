import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { Explorer } from './components/Explorer';
import { Inspector } from './components/Inspector';
import { DeleteFileModal } from './components/DeleteFileModal';
import { StatusToast } from './components/StatusToast';
import { UploadModal } from './components/UploadModal';
import { Management } from './components/Management';
import { SavedViewDialog } from './components/SavedViewDialog';
import { Loader2, UploadCloud } from 'lucide-react';
import { buildAvailableTagValues } from './lib/mock-data';
import type { FileItem, ActiveFilter, SavedView } from './lib/types';
import { buildTree } from './lib/tree';
import { createViewPathRestorer } from './lib/viewPathRestorer';
import { fileService } from './services/fileService';
import { preferenceService } from './services/preferenceService';
import * as apiService from './services/apiService';
import type { DimRow, TagRow } from './services/apiService';
import { availableDimensions as mockAvailableDimensions } from './lib/mock-data';
import { useFileStore } from './store/useFileStore';
import { selectVirtualTree } from './store/selectors';
import { ErrorBoundary } from './components/core/ErrorBoundary';
import { JobQueueOverlay } from './components/core/JobQueueOverlay';
import { PreviewModal } from './components/core/PreviewModal';
import { useJobStore } from './store/useJobStore';
import { jobQueue } from './services/jobQueue';
import { storageService } from './services/storageService';
import { isDevAuthBypassEnabled } from './services/core/apiClient';
import { normalizeSavedViews, reorderSavedViews } from './lib/savedViews';

const pathLabel = (path: string[]) => path.length > 0 ? path.join(' / ') : '全部文件';
const LOCAL_ORGANIZATION_VIEWS_KEY = 'metafile_organization_views';

function loadLocalOrganizationViews(): SavedView[] {
  return normalizeSavedViews(storageService.getJson<unknown>(LOCAL_ORGANIZATION_VIEWS_KEY, []));
}

function saveLocalOrganizationViews(views: SavedView[]): SavedView[] {
  const normalizedViews = reorderSavedViews(views);
  storageService.setJson(LOCAL_ORGANIZATION_VIEWS_KEY, normalizedViews);
  return normalizedViews;
}

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
  const [organizationViews, setOrganizationViews] = useState<SavedView[]>([]);
  const [dimensions, setDimensions] = useState<DimRow[]>(
    mockAvailableDimensions.map(d => ({ sys_id: d, WHMC: d, WHMS: d }))
  );
  const [knownTags, setKnownTags] = useState<(TagRow & { WHMC?: string })[]>([]);
  
  const availableDimensions = dimensions.map(d => d.WHMC);
  const availableTagValues = useMemo(() => {
    const values: Record<string, Set<string>> = {};

    for (const [dim, tags] of Object.entries(buildAvailableTagValues(files))) {
      values[dim] = new Set(tags);
    }

    for (const tag of knownTags) {
      const dimName = tag.WHMC?.trim();
      const tagValue = tag.BQZ?.trim();
      if (!dimName || !tagValue) continue;
      if (!values[dimName]) values[dimName] = new Set();
      values[dimName].add(tagValue);
    }

    return Object.fromEntries(
      Object.entries(values).map(([dim, tags]) => [
        dim,
        [...tags].sort((a, b) => a.localeCompare(b, 'zh-CN')),
      ])
    );
  }, [files, knownTags]);
  
  const [isDragging, setIsDragging] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);
  const [uploadModalFiles, setUploadModalFiles] = useState<FileItem[]>([]);
  const [pendingBrowserFiles, setPendingBrowserFiles] = useState<File[]>([]);
  const [pendingDeleteFileId, setPendingDeleteFileId] = useState<string | null>(null);
  const [isDeletingFile, setIsDeletingFile] = useState(false);
  const [deleteFileError, setDeleteFileError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ title: string; message: string; tone: 'success' | 'error' } | null>(null);
  const [isSaveCurrentViewDialogOpen, setIsSaveCurrentViewDialogOpen] = useState(false);
  
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
  const viewPathRestorerRef = useRef(createViewPathRestorer());

  const showToast = useCallback((title: string, message: string, tone: 'success' | 'error') => {
    setToast({ title, message, tone });
  }, []);

  const suggestedSavedViewName = useMemo(() => {
    if (currentPath.length > 0) return pathLabel(currentPath);
    return dimensionOrder.length > 0 ? `${dimensionOrder.join(' / ')} 视图` : '全部文件';
  }, [currentPath, dimensionOrder]);

  // 启动时异步从数据库初始化（自动写入种子数据）
  useEffect(() => {
    if (hasInitRunRef.current) return;
    hasInitRunRef.current = true;

    const initFromDb = async () => {
      try {
        if (isDevAuthBypassEnabled()) {
          const localFiles = fileService.getFiles();
          const localPreferences = {
            dimensionOrder: preferenceService.getDimensionOrder(),
            currentPath: preferenceService.getCurrentPath(),
            selectedFileId: preferenceService.getSelectedFileId(),
          };

          setFiles(localFiles, true);
          setDimensionOrder(localPreferences.dimensionOrder);
          setCurrentPath(localPreferences.currentPath);
          setSelectedFileId(localPreferences.selectedFileId);
          setOrganizationViews(loadLocalOrganizationViews());
          setDimensions(mockAvailableDimensions.map(d => ({ sys_id: d, WHMC: d, WHMS: d })));
          setKnownTags([]);
          return;
        }

        // console.log('[App] 正在从数据库初始化...');
        // 并行初始化文件 + 偏好 + 维度
        const [dbFiles, dbPrefs, dbDims, dbTags, dbOrganizationViews] = await Promise.all([
          fileService.initFromDb(),
          preferenceService.initFromDb(),
          apiService.queryAllDimensions(),
          apiService.queryAllTags().catch(() => []),
          apiService.queryOrganizationViews().catch(() => []),
        ]);

        // 更新状态
        setFiles(dbFiles);
        setDimensionOrder(dbPrefs.dimensionOrder);
        setCurrentPath(dbPrefs.currentPath);
        setSelectedFileId(dbPrefs.selectedFileId);
        setOrganizationViews(dbOrganizationViews);
        const databaseOrderChanged = dbPrefs.dimensionOrder.length !== dimensionOrder.length
          || dbPrefs.dimensionOrder.some((dimension, index) => dimension !== dimensionOrder[index]);
        if (databaseOrderChanged) {
          viewPathRestorerRef.current.schedule(dbPrefs.currentPath);
        }
        if (dbDims.length > 0) {
          setDimensions(dbDims);
        } else {
          // If DB is totally empty, we might want to fallback to mock just for UI, but let's sync real dbDims
          setDimensions(dbDims);
        }
        setKnownTags(dbTags);
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

  useEffect(() => {
    return fileService.subscribeSyncErrors((event) => {
      showToast(event.title, event.message, 'error');
    });
  }, [showToast]);

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
    setCurrentPath(viewPathRestorerRef.current.consumeDimensionOrderChange());
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
    if (!viewPathRestorerRef.current.shouldSanitizePath()) return;
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

  const refreshKnownTags = async () => {
    try {
      const tags = await apiService.queryAllTags();
      setKnownTags(tags);
    } catch (error) {
      console.warn('[App] 刷新标签字典失败:', error);
      showToast('标签字典刷新失败', '后端标签列表暂未刷新成功，请稍后重试或刷新页面。', 'error');
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

  const handleApplyView = useCallback((view: SavedView) => {
    const unavailableDimensions = view.dimensionOrder.filter((dimension) => !availableDimensions.includes(dimension));
    if (unavailableDimensions.length > 0) {
      showToast('预设路径已失效', `缺少维度：${unavailableDimensions.join('、')}。请在系统设置中更新该预设。`, 'error');
      return;
    }

    const targetTree = buildTree(files, view.dimensionOrder);
    let targetFolder = targetTree;
    const validPath: string[] = [];
    for (const segment of view.currentPath) {
      const nextFolder = targetFolder.subFolders[segment];
      if (!nextFolder) break;
      targetFolder = nextFolder;
      validPath.push(segment);
    }

    const restoredPathIsPartial = validPath.length !== view.currentPath.length;
    setSearchQuery('');
    setActiveFilters([]);
    setQuickFilter('all');
    setSelectedFileId(null);

    const dimensionOrderChanged = view.dimensionOrder.length !== dimensionOrder.length || view.dimensionOrder.some((dimension, index) => dimension !== dimensionOrder[index]);
    if (dimensionOrderChanged) {
      viewPathRestorerRef.current.schedule(validPath);
      setDimensionOrder([...view.dimensionOrder]);
    } else {
      setCurrentPath(validPath);
    }

    if (restoredPathIsPartial) {
      showToast('预设路径已变化', `“${view.name}”已跳转到仍可访问的上级目录。请在系统设置中更新该预设。`, 'error');
    } else {
      showToast('已切换预设视图', `已进入“${view.name}”。`, 'success');
    }
  }, [availableDimensions, dimensionOrder, files, showToast]);

  const handleOrganizationViewsChange = useCallback(async (views: SavedView[]) => {
    if (isDevAuthBypassEnabled()) {
      const savedViews = saveLocalOrganizationViews(views);
      setOrganizationViews(savedViews);
      return savedViews;
    }

    const savedViews = await apiService.saveOrganizationViews(views);
    setOrganizationViews(savedViews);
    return savedViews;
  }, []);

  const handleSaveCurrentView = useCallback(async ({ name }: { name: string; replaceTarget: boolean }) => {
    const now = new Date().toISOString();
    const nextView: SavedView = {
      id: apiService.generateUUID(),
      name,
      dimensionOrder: [...dimensionOrder],
      currentPath: [...currentPath],
      sortOrder: organizationViews.length,
      enabled: true,
      updatedAt: now,
    };

    try {
      await handleOrganizationViewsChange([...organizationViews, nextView]);
      setIsSaveCurrentViewDialogOpen(false);
      showToast('预设视图已保存', `“${name}”已加入左侧快捷入口。`, 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : '请稍后重试。';
      showToast('预设视图保存失败', message, 'error');
      throw error;
    }
  }, [currentPath, dimensionOrder, handleOrganizationViewsChange, organizationViews, showToast]);

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
          availableTagValues={availableTagValues}
          onCancel={() => {
            setUploadModalFiles([]);
            setPendingBrowserFiles([]);
          }}
          onConfirm={handleUploadConfirm}
        />
      )}

      {isSaveCurrentViewDialogOpen && (
        <SavedViewDialog
          title="保存当前视图"
          view={null}
          initialName={suggestedSavedViewName}
          currentPath={currentPath}
          currentDimensionOrder={dimensionOrder}
          onCancel={() => setIsSaveCurrentViewDialogOpen(false)}
          onSubmit={handleSaveCurrentView}
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
        <div className="pointer-events-none fixed bottom-6 right-6 z-[120]">
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
            organizationViews={organizationViews}
            onApplyView={handleApplyView}
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
              onSaveCurrentView={() => setIsSaveCurrentViewDialogOpen(true)}
            />
          </ErrorBoundary>
          <ErrorBoundary>
            <Inspector 
              selectedFile={selectedFile}
              allFiles={files}
              dimensionOrder={dimensionOrder}
              availableDimensions={availableDimensions}
              availableTagValues={availableTagValues}
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
          onNotify={showToast}
          onTagsChanged={refreshKnownTags}
          organizationViews={organizationViews}
          currentPath={currentPath}
          currentDimensionOrder={dimensionOrder}
          onOrganizationViewsChange={handleOrganizationViewsChange}
          onClose={() => setViewMode('explorer')}
        />
      )}
    </div>
  );
}

export default App;
