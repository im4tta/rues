export function getPlatform(url?: string | null): string {
  if (!url) return "github";
  try {
    const u = new URL(url);
    if (u.hostname === "github.com" || u.hostname === "www.github.com") return "github";
    if (u.hostname === "huggingface.co" || u.hostname === "www.huggingface.co") return "huggingface";
    if (u.hostname === "www.npmjs.com" || u.hostname === "npmjs.com") return "npm";
    if (u.hostname === "pypi.org" || u.hostname === "www.pypi.org") return "pypi";
  } catch {}
  return "github";
}

