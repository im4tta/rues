"use client";

import { useEffect, useState } from "react";
import { loadDirectory, loadPublishHandle } from "@/lib/storage";
import { parseShareHash } from "@/lib/share";
import type { Developer, Repo } from "@/lib/types";
import { ShareView } from "@/components/ShareView";

export default function SharePage() {
  const [devs, setDevs] = useState<Record<string, Developer>>({});
  const [repos, setRepos] = useState<Record<string, Repo>>({});
  const [handle, setHandle] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // A self-contained share link carries the directory in the URL fragment.
    const shared = parseShareHash(window.location.hash);
    if (shared) {
      setDevs(shared.devs);
      setRepos(shared.repos);
      setHandle(shared.handle);
      setReady(true);
      return;
    }

    // Otherwise fall back to this browser's local directory (preview).
    const d = loadDirectory();
    setDevs(d.devs);
    setRepos(d.repos);
    setHandle(loadPublishHandle());
    setReady(true);
  }, []);

  if (!ready) {
    return <div className="min-h-full bg-[var(--bg)] text-[var(--text)]" />;
  }

  return <ShareView devs={devs} repos={repos} handle={handle || undefined} />;
}
