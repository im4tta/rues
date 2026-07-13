export function downloadFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function copyText(text: string, setToast: (s: string) => void) {
  try {
    await navigator.clipboard.writeText(text);
    setToast("Copied to clipboard");
  } catch {
    setToast("Couldn't copy — select and copy manually");
  }
  setTimeout(() => setToast(""), 2000);
}

