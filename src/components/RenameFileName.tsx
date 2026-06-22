import { useEffect, useMemo, useRef, useState } from 'react';
import { Pencil } from 'lucide-react';
import type { FileItem } from '../lib/types';
import { cn } from '../lib/utils';
import { useFileStore } from '../store/useFileStore';

interface RenameFileNameProps {
  file: FileItem;
  siblingFiles: FileItem[];
  className?: string;
  textClassName?: string;
  inputClassName?: string;
  editButtonClassName?: string;
  onStartEdit?: () => void;
}

function splitFileName(fileName: string) {
  const dotIndex = fileName.lastIndexOf('.');
  if (dotIndex <= 0) {
    return { baseName: fileName, extension: '' };
  }
  return {
    baseName: fileName.slice(0, dotIndex),
    extension: fileName.slice(dotIndex),
  };
}

function hasInvalidFileNameChars(value: string) {
  return /[\\/:*?"<>|]/.test(value);
}

export function RenameFileName({
  file,
  siblingFiles,
  className,
  textClassName,
  inputClassName,
  editButtonClassName,
  onStartEdit,
}: RenameFileNameProps) {
  const renameFile = useFileStore(state => state.renameFile);
  const { baseName, extension } = useMemo(() => splitFileName(file.name), [file.name]);
  const [isEditing, setIsEditing] = useState(false);
  const [draftBaseName, setDraftBaseName] = useState(baseName);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) return;
    setDraftBaseName(baseName);
    setError('');
  }, [baseName, isEditing]);

  useEffect(() => {
    if (!isEditing || !inputRef.current) return;
    inputRef.current.focus();
    inputRef.current.select();
  }, [isEditing]);

  const startEditing = () => {
    setDraftBaseName(baseName);
    setError('');
    setIsEditing(true);
    onStartEdit?.();
  };

  const cancelEditing = () => {
    setDraftBaseName(baseName);
    setError('');
    setIsEditing(false);
  };

  const commitRename = () => {
    const trimmedBaseName = draftBaseName.trim();
    const nextName = `${trimmedBaseName}${extension}`;

    if (!trimmedBaseName) {
      setError('文件名不能为空');
      return;
    }
    if (hasInvalidFileNameChars(trimmedBaseName)) {
      setError('文件名包含非法字符');
      return;
    }
    if (nextName.length > 255) {
      setError('文件名过长');
      return;
    }
    const duplicate = siblingFiles.some(item => (
      item.id !== file.id && item.name.trim().toLowerCase() === nextName.toLowerCase()
    ));
    if (duplicate) {
      setError('当前视图下已有同名文件');
      return;
    }
    if (nextName !== file.name) {
      renameFile(file.id, nextName);
    }
    setIsEditing(false);
    setError('');
  };

  if (isEditing) {
    return (
      <div className={cn("min-w-0", className)} onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
        <div className="flex min-w-0 items-center">
          <input
            ref={inputRef}
            value={draftBaseName}
            onChange={(e) => {
              setDraftBaseName(e.target.value);
              setError('');
            }}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') cancelEditing();
            }}
            className={cn(
              "min-w-0 flex-1 rounded-md border border-indigo-300 bg-white px-2 py-1 text-sm font-medium text-gray-900 outline-none ring-2 ring-indigo-100",
              inputClassName
            )}
          />
          {extension && (
            <span className="ml-1 shrink-0 text-sm font-medium text-gray-400">{extension}</span>
          )}
        </div>
        {error && (
          <div className="mt-1 text-[11px] font-medium text-red-500">{error}</div>
        )}
      </div>
    );
  }

  return (
    <span
      className={cn("group/rename inline-flex min-w-0 items-center gap-1.5", className)}
      onDoubleClick={(e) => {
        e.stopPropagation();
        startEditing();
      }}
    >
      <span className={cn("min-w-0 truncate", textClassName)} title={file.name}>
        {file.name}
      </span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          startEditing();
        }}
        className={cn(
          "shrink-0 rounded p-0.5 text-gray-400 opacity-0 transition-all hover:bg-gray-100 hover:text-gray-800 group-hover/rename:opacity-100",
          editButtonClassName
        )}
        title="重命名"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
    </span>
  );
}
