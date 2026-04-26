const isStorageAvailable = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

export const storageKeys = {
  files: 'metafile_files',
  dimensions: 'metafile_dimensions',
  path: 'metafile_path',
  selectedFile: 'metafile_selectedFile',
} as const;

export const storageService = {
  getJson<T>(key: string, fallback: T): T {
    if (!isStorageAvailable()) return fallback;

    try {
      const rawValue = window.localStorage.getItem(key);
      return rawValue ? (JSON.parse(rawValue) as T) : fallback;
    } catch {
      return fallback;
    }
  },

  setJson<T>(key: string, value: T) {
    if (!isStorageAvailable()) return;

    window.localStorage.setItem(key, JSON.stringify(value));
  },

  getString(key: string, fallback: string | null = null) {
    if (!isStorageAvailable()) return fallback;

    try {
      return window.localStorage.getItem(key) ?? fallback;
    } catch {
      return fallback;
    }
  },

  setString(key: string, value: string) {
    if (!isStorageAvailable()) return;

    window.localStorage.setItem(key, value);
  },

  remove(key: string) {
    if (!isStorageAvailable()) return;

    window.localStorage.removeItem(key);
  },
};
