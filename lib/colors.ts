export const LANG_COLORS: Record<string, string> = {
  TypeScript: "#3178c6", JavaScript: "#f7df1e", Python: "#3572a5", Go: "#00add8",
  Rust: "#dea584", Java: "#b07219", C: "#555555", "C++": "#f34b7d", "C#": "#178600",
  Ruby: "#701516", PHP: "#4f5d95", Swift: "#ffac45", Kotlin: "#a97bff",
  Dart: "#00b4ab", Lua: "#000080", Haskell: "#5e5086", Scala: "#c22d40",
  Elixir: "#6e4a7e", Clojure: "#db5855", R: "#198ce7", Shell: "#89e051",
  HTML: "#e34c26", CSS: "#563d7c", Vue: "#41b883", Svelte: "#ff3e00",
};

export const languageColor = (lang?: string | null) => lang ? (LANG_COLORS[lang] || "var(--text-3)") : "var(--text-3)";

export const resolveColor = (c: string): string => {
  if (c.startsWith("var(")) {
    const name = c.slice(4, -1).trim();
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || "#888888";
  }
  return c;
};
