/**
 * Before the rename, preferences were stored under `lifeos.*`. Move them to
 * `dailypacer.*` once, on import, before anything reads them (i18n reads the
 * language at import time). Storage can be blocked; then there's nothing to move.
 */
export function migrateLegacyStorage(storage: Storage): void {
  const legacy: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key?.startsWith("lifeos.")) legacy.push(key);
  }
  for (const key of legacy) {
    const next = `dailypacer.${key.slice("lifeos.".length)}`;
    const value = storage.getItem(key);
    if (value !== null && storage.getItem(next) === null) storage.setItem(next, value);
    storage.removeItem(key);
  }
}

try {
  migrateLegacyStorage(window.localStorage);
} catch {
  // Storage unavailable (private window, blocked site data).
}
