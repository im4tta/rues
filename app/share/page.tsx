"use client";

import { useEffect, useState } from "react";
import { loadDirectory, loadPublishHandle } from "@/lib/storage";
import type { Developer, Repo } from "@/lib/types";
import { ShareView } from "@/components/ShareView";

export default function SharePage() {
  const [devs, setDevs] = useState<Record<string, Developer>>({});
  const [repos, setRepos] = useState<Record<string, Repo>>({});
  const [handle, setHandle] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
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
