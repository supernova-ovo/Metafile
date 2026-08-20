import { ArrowDown, ArrowUp, Bookmark, Edit2, Eye, EyeOff, MapPin, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { FileItem, SavedView } from '../lib/types';
import { buildTree, getAllFilesInFolder } from '../lib/tree';
import { reorderSavedViews } from '../lib/savedViews';
import { generateUUID } from '../services/apiService';
import { SavedViewDialog } from './SavedViewDialog';

interface OrganizationViewSettingsProps {
  views: SavedView[];
  files: FileItem[];
  availableDimensions: string[];
  currentPath: string[];
  currentDimensionOrder: string[];
  onChange: (views: SavedView[]) => Promise<SavedView[]>;
  onNotify?: (title: string, message: string, tone: 'success' | 'error') => void;
}

const pathLabel = (path: string[]) => path.length > 0 ? path.join(' / ') : '全部文件';

function inspectSavedViewTarget(view: SavedView, files: FileItem[], availableDimensions: string[]) {
  const missingDimensions = view.dimensionOrder.filter((dimension) => !availableDimensions.includes(dimension));
  const root = buildTree(files, view.dimensionOrder);
  let folder = root;
  const validPath: string[] = [];

  for (const segment of view.currentPath) {
    const nextFolder = folder.subFolders[segment];
    if (!nextFolder) break;
    folder = nextFolder;
    validPath.push(segment);
  }

  return {
    fileCount: getAllFilesInFolder(folder).length,
    isValid: missingDimensions.length === 0 && validPath.length === view.currentPath.length,
    missingDimensions,
  };
}

export function OrganizationViewSettings({
  views,
  files,
  availableDimensions,
  currentPath,
  currentDimensionOrder,
  onChange,
  onNotify,
}: OrganizationViewSettingsProps) {
  const [editingView, setEditingView] = useState<SavedView | null | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);

  const orderedViews = useMemo(() => reorderSavedViews([...views].sort((left, right) => left.sortOrder - right.sortOrder)), [views]);
  const targetStatusByViewId = useMemo(
    () => new Map(orderedViews.map((view) => [view.id, inspectSavedViewTarget(view, files, availableDimensions)])),
    [orderedViews, files, availableDimensions],
  );

  const persist = async (nextViews: SavedView[], successMessage: string) => {
    setIsSaving(true);
    try {
      await onChange(reorderSavedViews(nextViews));
      onNotify?.('预设视图已保存', successMessage, 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : '请稍后重试。';
      onNotify?.('预设视图保存失败', message, 'error');
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  const saveEditor = async ({ name, replaceTarget }: { name: string; replaceTarget: boolean }) => {
    const now = new Date().toISOString();
    const existing = editingView || null;
    const nextView: SavedView = existing
      ? {
          ...existing,
          name,
          dimensionOrder: replaceTarget ? [...currentDimensionOrder] : existing.dimensionOrder,
          currentPath: replaceTarget ? [...currentPath] : existing.currentPath,
          updatedAt: now,
        }
      : {
          id: generateUUID(),
          name,
          dimensionOrder: [...currentDimensionOrder],
          currentPath: [...currentPath],
          sortOrder: orderedViews.length,
          enabled: true,
          updatedAt: now,
        };

    const nextViews = existing
      ? orderedViews.map((view) => view.id === existing.id ? nextView : view)
      : [...orderedViews, nextView];
    await persist(nextViews, existing ? '已更新预设视图。' : '已新增预设视图。');
    setEditingView(undefined);
  };

  const move = async (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= orderedViews.length || isSaving) return;
    const nextViews = [...orderedViews];
    [nextViews[index], nextViews[target]] = [nextViews[target], nextViews[index]];
    await persist(nextViews, '已更新展示顺序。');
  };

  const toggleEnabled = async (view: SavedView) => {
    await persist(
      orderedViews.map((item) => item.id === view.id ? { ...item, enabled: !item.enabled, updatedAt: new Date().toISOString() } : item),
      view.enabled ? '已停用预设视图。' : '已启用预设视图。',
    );
  };

  const remove = async (view: SavedView) => {
    if (!window.confirm(`确认删除预设视图“${view.name}”吗？`)) return;
    await persist(orderedViews.filter((item) => item.id !== view.id), '已删除预设视图。');
  };

  return (
    <div className="flex-1 overflow-y-auto bg-white p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-7 flex items-start justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-bold text-gray-800">
              <Bookmark className="h-6 w-6 text-indigo-600" />
              预设视图
            </h2>
            <p className="mt-2 text-sm text-gray-500">仅在系统设置中维护。所有用户可在左侧“预设视图”中一键直达已启用的目标文件夹。</p>
          </div>
          <button onClick={() => setEditingView(null)} disabled={isSaving} className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50">
            <Plus className="h-4 w-4" />
            新建预设视图
          </button>
        </div>

        <div className="mb-5 rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 text-sm text-indigo-800">
          <p className="font-medium">当前浏览位置将作为新预设的目标</p>
          <p className="mt-1 break-all text-indigo-900">{pathLabel(currentPath)}</p>
          <p className="mt-1 text-xs text-indigo-600">维度顺序：{currentDimensionOrder.join(' / ') || '未设置'}。如需配置其他目标，请先返回文件浏览进入目标目录，再打开系统设置。</p>
        </div>

        {orderedViews.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 p-14 text-center">
            <Bookmark className="mb-4 h-10 w-10 text-gray-300" />
            <p className="font-medium text-gray-600">尚未配置预设视图</p>
            <p className="mt-1 text-sm text-gray-400">先回到目标资料路径，再在这里新建预设。</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-200 shadow-sm">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-gray-500">
                  <th className="px-5 py-3 font-semibold">名称</th>
                  <th className="px-5 py-3 font-semibold">目标路径</th>
                  <th className="px-5 py-3 font-semibold">文件 / 路径</th>
                  <th className="px-5 py-3 font-semibold">状态</th>
                  <th className="px-5 py-3 text-right font-semibold">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orderedViews.map((view, index) => {
                  const targetStatus = targetStatusByViewId.get(view.id);
                  const pathIsValid = targetStatus?.isValid ?? false;
                  return (
                    <tr key={view.id} className={!view.enabled ? 'bg-gray-50/70 text-gray-400' : 'hover:bg-gray-50/60'}>
                      <td className="px-5 py-4 font-medium text-gray-800">{view.name}</td>
                      <td className="max-w-md px-5 py-4 text-gray-600">
                        <span className="flex items-center gap-1.5 break-all"><MapPin className="h-4 w-4 shrink-0 text-indigo-400" />{pathLabel(view.currentPath)}</span>
                        <span className="mt-1 block text-xs text-gray-400">维度：{view.dimensionOrder.join(' / ') || '未设置'}</span>
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-medium text-gray-700">{targetStatus?.fileCount ?? 0} 个文件</p>
                        <p className={pathIsValid ? 'mt-1 text-xs text-emerald-600' : 'mt-1 text-xs text-red-600'}>
                          {pathIsValid
                            ? '路径有效'
                            : targetStatus?.missingDimensions.length
                              ? `缺少维度：${targetStatus.missingDimensions.join('、')}`
                              : '目标路径已失效'}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <span className={view.enabled ? 'rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700' : 'rounded-full bg-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600'}>
                          {view.enabled ? '已启用' : '已停用'}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => void move(index, -1)} disabled={isSaving || index === 0} title="上移" className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-indigo-600 disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                          <button onClick={() => void move(index, 1)} disabled={isSaving || index === orderedViews.length - 1} title="下移" className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-indigo-600 disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                          <button onClick={() => void toggleEnabled(view)} disabled={isSaving} title={view.enabled ? '停用' : '启用'} className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-indigo-600 disabled:opacity-30">{view.enabled ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
                          <button onClick={() => setEditingView(view)} disabled={isSaving} title="编辑" className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-indigo-600 disabled:opacity-30"><Edit2 className="h-4 w-4" /></button>
                          <button onClick={() => void remove(view)} disabled={isSaving} title="删除" className="rounded p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editingView !== undefined && (
        <SavedViewDialog
          title={editingView ? '编辑预设视图' : '新建预设视图'}
          view={editingView}
          currentPath={currentPath}
          currentDimensionOrder={currentDimensionOrder}
          onCancel={() => setEditingView(undefined)}
          onSubmit={saveEditor}
        />
      )}
    </div>
  );
}
