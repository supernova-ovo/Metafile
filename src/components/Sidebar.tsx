import React, { useMemo, useState } from 'react';
import { GripVertical, FolderTree, Target, RotateCcw, Settings, ChevronDown, Plus, Bookmark, Building2 } from 'lucide-react';
import { cn } from '../lib/utils';
import type { SavedView } from '../lib/types';

interface SidebarProps {
  dimensionOrder: string[];
  setDimensionOrder: (dimensions: string[]) => void;
  availableDimensions: string[];
  onReset: () => void;
  onOpenManagement?: () => void;
  organizationViews: SavedView[];
  onApplyView: (view: SavedView) => void;
}

const pathLabel = (path: string[]) => path.length > 0 ? path.join(' / ') : '全部文件';

export function Sidebar({
  dimensionOrder,
  setDimensionOrder,
  availableDimensions,
  onReset,
  onOpenManagement,
  organizationViews,
  onApplyView,
}: SidebarProps) {
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [isLibraryExpanded, setIsLibraryExpanded] = useState(true);
  const [isOrganizationViewsExpanded, setIsOrganizationViewsExpanded] = useState(false);

  const unusedDimensions = availableDimensions.filter(d => !dimensionOrder.includes(d));
  const visibleOrganizationViews = useMemo(
    () => organizationViews.filter(view => view.enabled).sort((left, right) => left.sortOrder - right.sortOrder),
    [organizationViews],
  );
  const displayedOrganizationViews = isOrganizationViewsExpanded
    ? visibleOrganizationViews
    : visibleOrganizationViews.slice(0, 6);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedItem(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleAddDimension = (dim: string) => {
    if (dimensionOrder.includes(dim)) return;
    setDimensionOrder([...dimensionOrder, dim]);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverIndex(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, dropTargetId: string, isUnusedArea = false) => {
    e.preventDefault();
    
    if (!draggedItem) return;
    
    const currentItem = draggedItem;
    // Clearing draggedItem immediately prevents the ghosting bug where the dropped item remains grayed out
    setDraggedItem(null);
    const dropIdx = dragOverIndex;
    setDragOverIndex(null);

    // If dropping into unused area
    if (isUnusedArea) {
      if (dimensionOrder.includes(currentItem)) {
        setDimensionOrder(dimensionOrder.filter(d => d !== currentItem));
      }
      return;
    }

    if (currentItem === dropTargetId && dropIdx === null) return;

    // Moving from unused to active
    if (!dimensionOrder.includes(currentItem)) {
      const newOrder = [...dimensionOrder];
      if (dropIdx !== null) {
        newOrder.splice(dropIdx, 0, currentItem);
      } else {
        newOrder.push(currentItem);
      }
      setDimensionOrder(newOrder);
      return;
    }

    // Moving within active
    if (dimensionOrder.includes(currentItem)) {
      const draggedIndex = dimensionOrder.indexOf(currentItem);
      const newOrder = [...dimensionOrder];
      newOrder.splice(draggedIndex, 1);
      
      let targetIdx = dropIdx !== null ? dropIdx : newOrder.length;
      if (draggedIndex < targetIdx && dropIdx !== null) {
        targetIdx--;
      }
      
      newOrder.splice(targetIdx, 0, currentItem);
      setDimensionOrder(newOrder);
      return;
    }
  };

  return (
    <div className="w-64 border-r border-border bg-[#FBFBFA] flex flex-col h-full text-sm">
      <div className="p-4 border-b border-border font-medium flex items-center gap-2 text-primary">
        <FolderTree className="w-5 h-5 text-indigo-600" />
        MetaFile
      </div>

      <div className="p-4 flex-1 min-h-0 overflow-hidden flex flex-col">
        <div className="mb-4 shrink-0 rounded-xl border border-indigo-100 bg-white p-3 shadow-sm">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-text-secondary">
            <Bookmark className="h-4 w-4 text-indigo-500" />
            预设视图
          </div>
          <p className="mb-2 px-2 text-[10px] leading-snug text-gray-400">管理员在系统设置中维护，点击后直达目标文件夹。</p>
          <div className="space-y-1">
            {displayedOrganizationViews.map(view => (
              <button key={view.id} onClick={() => onApplyView(view)} className="group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-gray-700 transition-colors hover:bg-indigo-50 hover:text-indigo-700" title={pathLabel(view.currentPath)}>
                <Building2 className="h-3.5 w-3.5 shrink-0 text-indigo-400" />
                <span className="min-w-0 flex-1 truncate">{view.name}</span>
              </button>
            ))}
            {visibleOrganizationViews.length === 0 && (
              <p className="px-2 py-1 text-xs text-gray-400">暂无预设视图</p>
            )}
          </div>
          {visibleOrganizationViews.length > 6 && (
            <button onClick={() => setIsOrganizationViewsExpanded(value => !value)} className="mt-1 w-full rounded-md px-2 py-1 text-xs text-indigo-600 transition-colors hover:bg-indigo-50">
              {isOrganizationViewsExpanded ? '收起预设视图' : `显示其余 ${visibleOrganizationViews.length - 6} 个预设`}
            </button>
          )}
        </div>

        <div className="mb-4 shrink-0">
          <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">维度编排区 (拖拽排序)</h3>
          <div 
            className={cn(
              "space-y-2 min-h-[120px] max-h-[220px] overflow-y-auto border-2 border-dashed p-3 rounded-xl transition-all duration-300",
              draggedItem ? "bg-indigo-50/40 border-indigo-300 shadow-inner" : "bg-white border-border"
            )}
            onDragOver={(e) => e.preventDefault()}
            onDragLeave={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
                setDragOverIndex(null);
              }
            }}
            onDrop={(e) => handleDrop(e, 'active')}
          >
            {dimensionOrder.map((dim, idx) => (
              <React.Fragment key={dim}>
                {dragOverIndex === idx && (
                  <div className="h-1.5 bg-indigo-500 rounded-full w-full shadow-sm my-1 animate-pulse pointer-events-none" />
                )}
                <div 
                  draggable
                  onDragStart={(e) => handleDragStart(e, dim)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (draggedItem === dim) {
                      setDragOverIndex(null);
                      return;
                    }

                    const rect = e.currentTarget.getBoundingClientRect();
                    const isBottomHalf = (e.clientY - rect.top) > rect.height / 2;
                    const newIdx = isBottomHalf ? idx + 1 : idx;

                    // Prevent line from rendering directly surrounding the dragged item
                    const draggedIdx = dimensionOrder.indexOf(draggedItem!);
                    if (draggedIdx !== -1 && (newIdx === draggedIdx || newIdx === draggedIdx + 1)) {
                      setDragOverIndex(null);
                      return;
                    }

                    setDragOverIndex(newIdx);
                  }}
                  className={cn(
                    "relative flex items-center gap-3 px-3 py-2.5 bg-white border rounded-lg cursor-grab active:cursor-grabbing transition-all duration-200",
                    draggedItem === dim ? "opacity-30 scale-95 shadow-none" : "shadow-sm hover:border-indigo-300 hover:shadow-md border-border"
                  )}
                >
                  <GripVertical className="w-4 h-4 text-gray-400" />
                  <div className="flex flex-col">
                    <span>{dim}</span>
                    <span className="text-[10px] text-gray-400">优先级 {idx + 1}</span>
                  </div>
                </div>
              </React.Fragment>
            ))}
            {dragOverIndex === dimensionOrder.length && dimensionOrder.length > 0 && (
              <div className="h-1.5 bg-indigo-500 rounded-full w-full shadow-sm mt-1 animate-pulse pointer-events-none" />
            )}
            {dimensionOrder.length === 0 && (
              <div className="text-gray-400 text-xs text-center py-6 flex flex-col items-center gap-2">
                <Target className="w-6 h-6 text-indigo-300 opacity-50" />
                将下方维度拖入此处
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col min-h-0">
          <button 
            onClick={() => setIsLibraryExpanded(!isLibraryExpanded)}
            className="flex items-center justify-between w-full text-left focus:outline-none mb-2 group shrink-0"
          >
            <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider group-hover:text-indigo-600 transition-colors">可用维度库</h3>
            <ChevronDown className={cn("w-4 h-4 text-gray-400 transition-transform duration-300", !isLibraryExpanded && "-rotate-90")} />
          </button>
          
          <div className={cn("transition-all duration-300 ease-in-out overflow-hidden flex flex-col min-h-0", isLibraryExpanded ? "flex-1 opacity-100" : "flex-none h-0 opacity-0")}>
            <p className="text-[10px] text-gray-400 mb-3 leading-snug shrink-0">将底部的维度属性拽入上方的编排区，自动形成嵌套的目录层级。</p>
            <div 
              className={cn(
                "space-y-2 flex-1 min-h-0 p-3 rounded-xl border-2 border-dashed transition-all duration-300 overflow-y-auto mb-2",
                draggedItem && dimensionOrder.includes(draggedItem) ? "bg-red-50/50 border-red-200" : "border-transparent bg-transparent"
              )}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, 'unused', true)}
            >
              {unusedDimensions.map(dim => (
                <div 
                  key={dim}
                  draggable
                  onDragStart={(e) => handleDragStart(e, dim)}
                  onDragEnd={handleDragEnd}
                  className={cn(
                    "group flex items-center justify-between gap-2 px-3 py-2 bg-[#F5F5F4] border border-transparent rounded-lg cursor-grab active:cursor-grabbing hover:opacity-100 transition-all duration-200",
                    draggedItem === dim ? "opacity-30 scale-95" : "opacity-80 hover:bg-white hover:border-gray-300 hover:shadow-sm"
                  )}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <GripVertical className="w-4 h-4 shrink-0 text-gray-400" />
                    <span className="truncate" title={dim}>{dim}</span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddDimension(dim);
                    }}
                    className="shrink-0 rounded-md p-1 text-gray-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600"
                    title="加入维度编排"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {unusedDimensions.length === 0 && (
                <div className="text-center text-xs text-gray-400 py-2">已开启所有维度</div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 shrink-0 pt-4 border-t border-border space-y-2">
          {onOpenManagement && (
            <button 
              onClick={onOpenManagement}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 rounded-md transition-colors text-sm font-medium border border-transparent hover:border-indigo-100"
            >
              <Settings className="w-4 h-4" />
              系统设置
            </button>
          )}
          <button 
            onClick={onReset}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-red-500 hover:bg-red-50 hover:text-red-700 rounded-md transition-colors text-sm font-medium border border-transparent hover:border-red-100"
          >
            <RotateCcw className="w-4 h-4" />
            重置系统数据
          </button>
        </div>
      </div>
    </div>
  );
}
