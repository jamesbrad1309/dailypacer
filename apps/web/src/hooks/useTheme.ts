import { useEffect, useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

const KEY = "dailypacer.theme";

function systemTheme(): Theme {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function stored(): Theme {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw === null ? systemTheme() : (JSON.parse(raw) as Theme);
  } catch {
    return systemTheme();
  }
}

// One theme for the whole app, so the app bar's button and the command
// palette's "Toggle theme" always agree.
let current: Theme | null = null;
const listeners = new Set<() => void>();
const get = () => {
  current ??= stored();
  return current;
};

export function setTheme(theme: Theme): void {
  current = theme;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(theme));
  } catch {
    // Not persisted this time; the in-memory value still works.
  }
  for (const listener of listeners) listener();
}

export function toggleTheme(): void {
  setTheme(get() === "dark" ? "light" : "dark");
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Light/dark via the `.dark` class index.css already defines; starts from the OS setting. */
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, get, get);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);
  return { theme, toggle: toggleTheme };
}
