import React, { useState } from 'react';
import { GripVertical, FolderTree, Building, Target, FileType, RotateCcw } from 'lucide-react';
import { availableDimensions } from '../lib/mock-data';
import { cn } from '../lib/utils';

interface SidebarProps {
  dimensionOrder: string[];
  setDimensionOrder: (dimensions: string[]) => void;
  onReset: () => void;
}

export function Sidebar({ dimensionOrder, setDimensionOrder, onReset }: SidebarProps) {
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const unusedDimensions = availableDimensions.filter(d => !dimensionOrder.includes(d));

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedItem(id);
    e.dataTransfer.effectAllowed = 'move';
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

  const applyPreset = (preset: string[]) => {
    setDimensionOrder(preset);
  };

  return (
    <div className="w-64 border-r border-border bg-[#FBFBFA] flex flex-col h-full text-sm">
      <div className="p-4 border-b border-border font-medium flex items-center gap-2 text-primary">
        <FolderTree className="w-5 h-5 text-indigo-600" />
        MetaFile
      </div>

      <div className="p-4 flex-1 overflow-y-auto">
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">预设视图</h3>
          <div className="space-y-1">
            <button 
              onClick={() => applyPreset(['部门', '密级'])}
              className="w-full text-left px-3 py-2 rounded-md hover:bg-accent hover:text-primary transition-colors flex items-center gap-2 text-text-secondary"
            >
              <Building className="w-4 h-4" />
              按行政分类 (部门&gt;密级)
            </button>
            <button 
              onClick={() => applyPreset(['项目', '文件类型'])}
              className="w-full text-left px-3 py-2 rounded-md hover:bg-accent hover:text-primary transition-colors flex items-center gap-2 text-text-secondary"
            >
              <Target className="w-4 h-4" />
              按项目管理 (项目&gt;类型)
            </button>
            <button 
              onClick={() => applyPreset(['密级', '部门'])}
              className="w-full text-left px-3 py-2 rounded-md hover:bg-accent hover:text-primary transition-colors flex items-center gap-2 text-text-secondary"
            >
              <FileType className="w-4 h-4" />
              涉密检查视角
            </button>
          </div>
        </div>

        <div className="mb-8">
          <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">维度编排区 (拖拽排序)</h3>
          <div 
            className={cn(
              "space-y-2 min-h-[120px] border-2 border-dashed p-3 rounded-xl transition-all duration-300",
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

        <div>
          <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">可用维度库</h3>
          <p className="text-[10px] text-gray-400 mb-3 leading-snug">将底部的维度属性拽入上方的编排区，自动形成嵌套的目录层级。</p>
          <div 
            className={cn(
              "space-y-2 min-h-[80px] p-3 rounded-xl border-2 border-dashed transition-all duration-300",
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
                  "flex items-center gap-2 px-3 py-2 bg-[#F5F5F4] border border-transparent rounded-lg cursor-grab active:cursor-grabbing hover:opacity-100 transition-all duration-200",
                  draggedItem === dim ? "opacity-30 scale-95" : "opacity-80 hover:bg-white hover:border-gray-300 hover:shadow-sm"
                )}
              >
                <GripVertical className="w-4 h-4 text-gray-400" />
                <span>{dim}</span>
              </div>
            ))}
            {unusedDimensions.length === 0 && (
              <div className="text-center text-xs text-gray-400 py-2">已开启所有维度</div>
            )}
          </div>
        </div>

        <div className="mt-8 pt-4 border-t border-border">
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
