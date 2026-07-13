"use client";

import { useEffect, useState } from "react";
import { ShareView } from "@/components/ShareView";
import type { Developer, Repo } from "@/lib/types";

export default function ShareSlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const [devs, setDevs] = useState<Record<string, Developer>>({});
  const [repos, setRepos] = useState<Record<string, Repo>>({});
  const [handle, setHandle] = useState("");
  const [publishedAt, setPublishedAt] = useState("");
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const { slug } = await params;
      try {
        const res = await fetch(`/api/publish/${slug}`);
        if (!res.ok) {
          if (active) {
            setError(res.status === 404 ? "This shared directory doesn't exist (yet)." : "Failed to load.");
            setReady(true);
          }
          return;
        }
        const j = await res.json();
        if (!active) return;
        setDevs(j.data.devs || {});
        setRepos(j.data.repos || {});
        setHandle(j.handle || slug);
        setPublishedAt(j.updatedAt || "");
        setReady(true);
      } catch {
        if (active) {
          setError("Failed to load this directory.");
          setReady(true);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [params]);

  if (!ready) {
    return <div className="min-h-full bg-[var(--bg)] text-[var(--text)]" />;
  }

  if (error) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-3 bg-[var(--bg)] text-[var(--text)]">
        <h1 className="font-display text-xl font-bold">Rues ឫស</h1>
        <p className="text-[13px] text-[var(--text-3)]">{error}</p>
      </div>
    );
  }

  return <ShareView devs={devs} repos={repos} handle={handle} publishedAt={publishedAt} />;
}
