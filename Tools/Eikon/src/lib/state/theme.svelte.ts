/** Theme state. Light = Solarized; Dark = official DESIGN.md dark palette. */
export type ThemeMode = "light" | "dark";

const KEY = "idphoto-theme";

function initial(): ThemeMode {
  const saved = localStorage.getItem(KEY) as ThemeMode | null;
  if (saved) return saved;
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

class ThemeStore {
  mode = $state<ThemeMode>("light");

  init() {
    this.mode = initial();
    this.#apply();
  }

  toggle() {
    this.mode = this.mode === "light" ? "dark" : "light";
    localStorage.setItem(KEY, this.mode);
    this.#apply();
  }

  #apply() {
    document.documentElement.dataset.theme = this.mode;
  }
}

export const theme = new ThemeStore();
