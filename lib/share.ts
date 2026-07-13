// Self-contained share links: the directory snapshot is encoded into the URL
// fragment (after `#`) so it works for anyone who opens the link — no backend,
// no server-side storage, no "directory doesn't exist" 404s. Fragments are
// never sent to the server, so there is no practical URL-length transmission
// limit (only the browser's own memory).

export function utf8ToBase64Url(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64UrlToUtf8(s: string): string {
  const norm = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(norm);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export function encodeShare(devs: Record<string, any>, repos: Record<string, any>, handle?: string): string {
  const payload = JSON.stringify({ devs, repos, handle: handle || "" });
  return `/share#d=${utf8ToBase64Url(payload)}`;
}

export function parseShareHash(hash: string): { devs: Record<string, any>; repos: Record<string, any>; handle: string } | null {
  if (!hash) return null;
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  const params = new URLSearchParams(clean);
  const d = params.get("d");
  if (!d) return null;
  try {
    const obj = JSON.parse(base64UrlToUtf8(d));
    return {
      devs: obj.devs || {},
      repos: obj.repos || {},
      handle: obj.handle || params.get("h") || "",
    };
  } catch {
    return null;
  }
}
