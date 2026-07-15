function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '未知大小';

  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  const precision = size >= 10 || unitIndex === 0 ? 0 : 1;
  return `${size.toFixed(precision)} ${units[unitIndex]}`;
}

export function createUploadHttpError(response: Response, file: File): Error {
  if (response.status === 413) {
    return new Error(
      `文件过大，服务器拒绝接收（413）。当前文件约 ${formatFileSize(file.size)}，请压缩后再上传，或联系管理员调大上传大小限制。`
    );
  }

  if (response.status === 401 || response.status === 403) {
    return new Error('登录状态已失效或没有上传权限，请重新登录后再试。');
  }

  if (response.status >= 500) {
    return new Error(`服务器暂时无法处理上传（${response.status}），请稍后重试。`);
  }

  return new Error(`上传请求失败（${response.status}），请稍后重试。`);
}

export function createMissingUploadUrlError(): Error {
  return new Error('文件已提交到上传接口，但服务器没有返回文件地址，请重试或联系管理员检查上传接口。');
}

export function getUploadErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return '上传失败，请稍后重试。';
}
