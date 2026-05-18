/** Theme state. Light = Solarized; Dark = official DESIGN.md dark palette. */
export type ThemeMode = "light" | "dark";

const KEY = "eikon-theme";

// localStorage can throw (Safari private mode, disabled storage, sandboxed
// iframe). Persistence is best-effort and must never break app init/toggle.
function readSaved(): ThemeMode | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : null;
  } catch {
    return null;
  }
}
function writeSaved(mode: ThemeMode): void {
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    /* best-effort */
  }
}

function initial(): ThemeMode {
  return readSaved() ?? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
}

class ThemeStore {
  mode = $state<ThemeMode>("light");

  init() {
    this.mode = initial();
    this.#apply();
  }

  toggle() {
    this.mode = this.mode === "light" ? "dark" : "light";
    // Apply before persisting so a storage exception can't block the UI.
    this.#apply();
    writeSaved(this.mode);
  }

  #apply() {
    document.documentElement.dataset.theme = this.mode;
  }
}

export const theme = new ThemeStore();
