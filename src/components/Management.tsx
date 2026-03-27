import React, { useState, useMemo } from 'react';
import { ArrowLeft, Edit2, Merge, Trash2, ChevronDown } from 'lucide-react';
import type { FileItem } from '../lib/types';
import { availableDimensions } from '../lib/mock-data';

interface ManagementProps {
  files: FileItem[];
  setFiles: React.Dispatch<React.SetStateAction<FileItem[]>>;
  onClose: () => void;
}

export function Management({ files, setFiles, onClose }: ManagementProps) {
  const [selectedDimension, setSelectedDimension] = useState<string>(availableDimensions[0] || '');
  const [isExpanded, setIsExpanded] = useState(true);

  // Compute tag statistics for the selected dimension
  const tagStats = useMemo(() => {
    if (!selectedDimension) return [];
    
    const stats: Record<string, number> = {};
    files.forEach(file => {
      const tags = file.attributes[selectedDimension];
      if (tags && tags.length > 0) {
        tags.forEach(tag => {
          stats[tag] = (stats[tag] || 0) + 1;
        });
      }
    });

    return Object.entries(stats)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count); // Sort by usage descending
  }, [files, selectedDimension]);

  const handleRename = (oldName: string) => {
    const newName = window.prompt(`请为标签「${oldName}」输入新的名称：`, oldName);
    if (!newName || newName.trim() === '' || newName === oldName) return;
    
    const trimmed = newName.trim();
    
    setFiles(prev => prev.map(file => {
      const currentTags = file.attributes[selectedDimension];
      if (!currentTags || !currentTags.includes(oldName)) return file;
      
      const newTags = currentTags.map(t => (t === oldName ? trimmed : t));
      // Remove duplicates just in case the new name already existed in this file's tags
      const uniqueTags = Array.from(new Set(newTags));
      
      return {
        ...file,
        attributes: {
          ...file.attributes,
          [selectedDimension]: uniqueTags
        }
      };
    }));
  };

  const handleMerge = (sourceName: string) => {
    const targetName = window.prompt(`你想将标签「${sourceName}」合并到哪个标签？\n（输入目标标签的名称）`);
    if (!targetName || targetName.trim() === '' || targetName === sourceName) return;
    
    const trimmed = targetName.trim();
    
    setFiles(prev => prev.map(file => {
      const currentTags = file.attributes[selectedDimension];
      if (!currentTags || !currentTags.includes(sourceName)) return file;
      
      // Remove sourceName, add targetName
      const newTags = currentTags.filter(t => t !== sourceName);
      if (!newTags.includes(trimmed)) {
        newTags.push(trimmed);
      }
      
      return {
        ...file,
        attributes: {
          ...file.attributes,
          [selectedDimension]: newTags
        }
      };
    }));
  };

  const handleDelete = (tagName: string) => {
    if (window.confirm(`确定要从所有文件中删除标签「${tagName}」吗？\n删除后该操作不可恢复。`)) {
      setFiles(prev => prev.map(file => {
        const currentTags = file.attributes[selectedDimension];
        if (!currentTags || !currentTags.includes(tagName)) return file;
        
        return {
          ...file,
          attributes: {
            ...file.attributes,
            [selectedDimension]: currentTags.filter(t => t !== tagName)
          }
        };
      }));
    }
  };

  // Deterministic color generation based on string
  const getTagColor = (tagName: string) => {
    let hash = 0;
    for (let i = 0; i < tagName.length; i++) {
        hash = tagName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 70%, 90%)`;
  };

  const getTextColor = (tagName: string) => {
    let hash = 0;
    for (let i = 0; i < tagName.length; i++) {
        hash = tagName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 80%, 25%)`;
  };

  return (
    <div className="flex flex-col h-full w-full bg-white">
      {/* Top Header */}
      <div className="h-16 border-b border-gray-200 flex items-center px-6 bg-white shadow-sm shrink-0">
        <button 
          onClick={onClose}
          className="flex items-center gap-2 text-gray-500 hover:text-indigo-600 transition-colors font-medium px-4 py-2 rounded-lg hover:bg-indigo-50"
        >
          <ArrowLeft className="w-5 h-5" />
          返回文件浏览
        </button>
        <div className="h-6 w-px bg-gray-200 mx-6"></div>
        <h1 className="text-xl font-bold text-gray-800">
          ⚙️ 系统设置 / 属性管理
        </h1>
      </div>

      {/* Main Content: Two Panes */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Left Pane: Dimensions */}
        <div className="w-72 bg-gray-50 border-r border-gray-200 flex flex-col hide-scrollbar">
          <button 
            className="p-4 border-b border-gray-200 flex items-center justify-between w-full hover:bg-gray-100 transition-colors"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
              可用属性维度
            </h2>
            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-300 ${!isExpanded ? '-rotate-90' : ''}`} />
          </button>
          
          <div className={`transition-all duration-300 ease-in-out overflow-hidden flex flex-col min-h-0 ${isExpanded ? 'flex-1 opacity-100' : 'flex-none h-0 opacity-0'}`}>
            <div className="flex-1 overflow-y-auto p-4 space-y-1">
              {availableDimensions.map(dim => (
                <button
                  key={dim}
                  onClick={() => setSelectedDimension(dim)}
                  className={`w-full text-left px-4 py-3 rounded-lg font-medium transition-all ${
                    selectedDimension === dim 
                      ? 'bg-indigo-100 text-indigo-700 shadow-sm border border-indigo-200' 
                      : 'text-gray-600 hover:bg-gray-100 border border-transparent'
                  }`}
                >
                  {dim}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Pane: Tags */}
        <div className="flex-1 overflow-y-auto bg-white p-8">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
              <span className="text-indigo-600 px-3 py-1 bg-indigo-50 rounded-md text-xl">
                {selectedDimension}
              </span>
              维度下的标签
            </h2>

            {tagStats.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-16 border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50">
                <span className="text-4xl mb-4">🏷️</span>
                <p className="text-gray-500 font-medium">当前维度下暂无标签</p>
                <p className="text-gray-400 text-sm mt-1">在文件视图中为文件添加该维度标签后即可在此管理</p>
              </div>
            ) : (
              <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-6 py-4 text-sm font-semibold text-gray-500 w-1/3">标签名称 / 颜色</th>
                      <th className="px-6 py-4 text-sm font-semibold text-gray-500 w-1/4">使用情况</th>
                      <th className="px-6 py-4 text-sm font-semibold text-gray-500 text-right w-1/3">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {tagStats.map(stat => (
                      <tr key={stat.name} className="hover:bg-gray-50/50 transition-colors group">
                        <td className="px-6 py-4">
                          <span 
                            className="px-3 py-1 rounded-full text-sm font-medium border shadow-sm"
                            style={{ 
                              backgroundColor: getTagColor(stat.name), 
                              color: getTextColor(stat.name),
                              borderColor: 'rgba(0,0,0,0.05)'
                            }}
                          >
                            {stat.name}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="flex items-center gap-1.5 text-gray-600 text-sm font-medium">
                            <span className="inline-block w-2 h-2 rounded-full bg-green-400"></span>
                            {stat.count} 个文件
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => handleRename(stat.name)}
                              className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors tooltip"
                              title="重命名"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleMerge(stat.name)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                              title="合并到..."
                            >
                              <Merge className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleDelete(stat.name)}
                              className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors ml-2"
                              title="彻底删除"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
