import { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Explorer } from './components/Explorer';
import { Inspector } from './components/Inspector';
import { UploadModal } from './components/UploadModal';
import { Management } from './components/Management';
import { UploadCloud } from 'lucide-react';
import { mockFiles } from './lib/mock-data';
import { buildTree } from './lib/tree';
import type { FileItem, ActiveFilter } from './lib/types';

function App() {
  const [files, setFiles] = useState<FileItem[]>(() => {
    try {
      const saved = localStorage.getItem('metafile_files');
      return saved ? JSON.parse(saved) : mockFiles;
    } catch {
      return mockFiles;
    }
  });
  
  const [dimensionOrder, setDimensionOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('metafile_dimensions');
      return saved ? JSON.parse(saved) : ['部门', '密级'];
    } catch {
      return ['部门', '密级'];
    }
  });
  
  const [currentPath, setCurrentPath] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('metafile_path');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [selectedFileId, setSelectedFileId] = useState<string | null>(() => {
    try {
      return localStorage.getItem('metafile_selectedFile') || null;
    } catch {
      return null;
    }
  });
  
  const [isDragging, setIsDragging] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);
  const [uploadModalFiles, setUploadModalFiles] = useState<FileItem[]>([]);
  
  // View mode
  const [viewMode, setViewMode] = useState<'explorer' | 'management'>('explorer');
  
  
  // Search and Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);
  const [quickFilter, setQuickFilter] = useState("all");

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
      
      const baseAttributes: Record<string, string[]> = {};
      currentPath.forEach((segment, idx) => {
        const dim = dimensionOrder[idx];
        if (dim) baseAttributes[dim] = [segment];
      });

      const newFileItems: FileItem[] = droppedFiles.map((f, i) => ({
        id: `upload-${Date.now()}-${i}`,
        name: f.name,
        type: f.name.split('.').pop() || 'unknown',
        size: f.size,
        updatedAt: new Date(f.lastModified).toISOString(),
        attributes: JSON.parse(JSON.stringify(baseAttributes))
      }));

      setUploadModalFiles(newFileItems);
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

  // Sync to LocalStorage
  useEffect(() => {
    localStorage.setItem('metafile_files', JSON.stringify(files));
  }, [files]);

  useEffect(() => {
    localStorage.setItem('metafile_dimensions', JSON.stringify(dimensionOrder));
  }, [dimensionOrder]);

  useEffect(() => {
    localStorage.setItem('metafile_path', JSON.stringify(currentPath));
  }, [currentPath]);

  useEffect(() => {
    if (selectedFileId) {
      localStorage.setItem('metafile_selectedFile', selectedFileId);
    } else {
      localStorage.removeItem('metafile_selectedFile');
    }
  }, [selectedFileId]);

  const handleResetSystem = () => {
    if (window.confirm('确定要重置整个文件系统并清空所有上传与修改的数据吗？')) {
      localStorage.removeItem('metafile_files');
      localStorage.removeItem('metafile_dimensions');
      localStorage.removeItem('metafile_path');
      localStorage.removeItem('metafile_selectedFile');
      setFiles(mockFiles);
      setDimensionOrder(['部门', '密级']);
      setCurrentPath([]);
      setSelectedFileId(null);
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
    setFiles(prev => prev.map(f => f.id === fileId ? { ...f, attributes: newAttrs } : f));
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
          onCancel={() => setUploadModalFiles([])}
          onConfirm={(finalFiles) => {
            setFiles(prev => [...prev, ...finalFiles]);
            setUploadModalFiles([]);
          }}
        />
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
