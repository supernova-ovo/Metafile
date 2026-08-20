/**
 * Coordinates a preset path restore with the explorer's normal invalid-path
 * cleanup. React effects for a dimension-order change see the old path once;
 * that render must not overwrite the saved destination.
 */
export function createViewPathRestorer() {
  let pendingPath: string[] | null = null;
  let skipNextPathSanitization = false;

  return {
    schedule(path: string[]) {
      pendingPath = [...path];
    },

    consumeDimensionOrderChange(): string[] {
      const path = pendingPath;
      pendingPath = null;
      skipNextPathSanitization = path !== null;
      return path ?? [];
    },

    shouldSanitizePath(): boolean {
      if (skipNextPathSanitization) {
        skipNextPathSanitization = false;
        return false;
      }
      return true;
    },
  };
}
