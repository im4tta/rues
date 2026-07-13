"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import {
  AlertCircle,
  Check,
  CheckSquare,
  Download,
  FileText,
  FolderGit2,
  Folder,
  Pencil,
  GitCommit,
  Link,
  Loader2,
  Moon,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Star,
  Sun,
  Tag as TagIcon,
  Upload,
  User,
  UserCircle,
  X
} from "lucide-react";
import type { Developer, Repo, DirectoryData, Item, Density, UIPrefs, ViewPreset } from "@/lib/types";
import { DEFAULT_UI, VIRTUALIZE_THRESHOLD } from "@/lib/constants";
import { sortItems, buildSections } from "@/lib/sort";
import { downloadFile } from "@/lib/download";
import { loadDirectory, saveDirectory, loadPresets, savePresets, loadMyUsername, saveMyUsername, savePublishHandle, loadPublishHandle } from "@/lib/storage";
import { encodeShare } from "@/lib/share";
import { ghUser, ghRepo, ghStarred } from "@/lib/github";
import {
  buildDevMarkdown,
  buildRepoMarkdown,
  buildDevMarkdownMd,
  buildRepoMarkdownMd
} from "@/lib/obsidian";
import { suggestDevTags, suggestRepoTags, buildDigest } from "@/lib/analytics";
import { Dropdown, MenuGroup, SegBtn } from "@/components/ui/Dropdown";
import { VirtualList } from "@/components/ui/VirtualList";
import { DevCard } from "@/components/cards/DevCard";
import { RepoCard } from "@/components/cards/RepoCard";
import { RepoBrowser } from "@/components/RepoBrowser";
import { GraphView } from "@/components/GraphView";
import { FolderPicker } from "@/components/ui/FolderPicker";
import Insights from "./Insights";

export default function DevTracker() {
  const [data, setData] = useState<DirectoryData>({ devs: {}, repos: {}, folders: [] });
  const [loaded, setLoaded] = useState(false);
  const [ui, setUI] = useState<UIPrefs>(DEFAULT_UI);
  const [presets, setPresets] = useState<ViewPreset[]>([]);
  const [query, setQuery] = useState("");
  const [newDev, setNewDev] = useState("");
  const [newRepo, setNewRepo] = useState("");
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [saving, setSaving] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const [theme, setTheme] = useState<"dark" | "light" | "angkor" | "mekong">("dark");
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [browsing, setBrowsing] = useState<string | null>(null);
  const [bulkTag, setBulkTag] = useState("");
  // Delete modal state
  type DeleteModalState = null | {
    type: "dev";
    username: string;
    linkedItemsToDelete: string[];
  } | {
    type: "repo";
    fullName: string;
    linkedItemsToDelete: string[];
  };
  const [deleteModal, setDeleteModal] = useState<DeleteModalState>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const importMdInputRef = useRef<HTMLInputElement>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState("");
  const [starredUser, setStarredUser] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const [importResults, setImportResults] = useState<string[]>([]);
  const searchRef = useRef<HTMLInputElement>(null);

  // Own-profile (no login) + publish state
  const [myUsername, setMyUsernameState] = useState("");
  const [myProfileOpen, setMyProfileOpen] = useState(false);
  const [myProfileInput, setMyProfileInput] = useState("");
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishHandleInput, setPublishHandleInput] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState("");
  const [publishResult, setPublishResult] = useState<{ slug: string; url: string } | null>(null);

  // Folder organization (each dev/repo lives in at most one folder).
  const [activeFolder, setActiveFolder] = useState<string>("all");
  const [folderInputOpen, setFolderInputOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState("");

  useEffect(() => {
    const initial = loadDirectory();
    setData(initial);
    historyRef.current = [initial];
    setHistoryIdx(0);
    setLoaded(true);
    setPresets(loadPresets());
    setMyUsernameState(loadMyUsername());
  }, []);

  // Restore persisted UI preferences.
  useEffect(() => {
    try {
      const raw = localStorage.getItem("devtrack-ui");
      if (raw) setUI((u) => ({ ...u, ...JSON.parse(raw) }));
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("devtrack-ui", JSON.stringify(ui));
    } catch {
      /* ignore */
    }
  }, [ui]);

  // Sync theme state with the <html data-theme> attribute set by the bootstrap script.
  useEffect(() => {
    const t = (document.documentElement.dataset.theme as "dark" | "light" | "angkor" | "mekong") || "dark";
    setTheme(t);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("devtrack-theme", theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  const historyRef = useRef<DirectoryData[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);

  const persist = useCallback((next: DirectoryData) => {
    setData(next);
    const ok = saveDirectory(next);
    setSaving(true);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => setSaving(false), 600);
    if (!ok) {
      setError("Couldn't save to this browser's storage — your last change may not persist. Try Export as a backup.");
      setTimeout(() => setError(""), 4000);
    }
    const stack = historyRef.current;
    const truncated = stack.slice(0, historyIdx + 1);
    truncated.push(next);
    if (truncated.length > 50) truncated.shift();
    historyRef.current = truncated;
    setHistoryIdx(truncated.length - 1);
  }, [historyIdx]);

  const undo = useCallback(() => {
    const idx = historyIdx - 1;
    if (idx < 0) return;
    const prev = historyRef.current[idx];
    if (!prev) return;
    setHistoryIdx(idx);
    setData(prev);
    saveDirectory(prev);
  }, [historyIdx]);

  const redo = useCallback(() => {
    const idx = historyIdx + 1;
    if (idx >= historyRef.current.length) return;
    const next = historyRef.current[idx];
    if (!next) return;
    setHistoryIdx(idx);
    setData(next);
    saveDirectory(next);
  }, [historyIdx]);

  // Keyboard shortcuts: / focus search, g/l/v view, t theme, Ctrl+Z undo, Ctrl+Shift+Z redo, Esc close.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tgt = e.target as HTMLElement | null;
      const typing =
        !!tgt && (tgt.tagName === "INPUT" || tgt.tagName === "TEXTAREA" || tgt.isContentEditable);
      if (e.key === "/" && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
      } else if ((e.key === "g" || e.key === "l" || e.key === "v" || e.key === "i") && !typing && !e.metaKey && !e.ctrlKey) {
        setUI((u) => ({ ...u, view: e.key === "g" ? "grid" : e.key === "v" ? "graph" : e.key === "i" ? "insights" : "list" }));
      } else if (e.key === "t" && !typing && !e.metaKey && !e.ctrlKey) {
        setTheme((th) => th === "dark" ? "angkor" : th === "angkor" ? "mekong" : th === "mekong" ? "light" : "dark");
      } else if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.metaKey || e.ctrlKey) && e.key === "z" && e.shiftKey) {
        e.preventDefault();
        redo();
      } else if (e.key === "Escape") {
        if (browsing) setBrowsing(null);
        else if (selectMode) {
          setSelectMode(false);
          setSelected(new Set());
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [browsing, selectMode, undo, redo]);

  const showError = (msg: string) => {
    setError(msg);
    setTimeout(() => setError(""), 3000);
  };

  const updateUI = (patch: Partial<UIPrefs>) => setUI((u) => ({ ...u, ...patch }));

  // ---- Folders ----
  const activeFolderId = activeFolder === "all" || activeFolder === "unfiled" ? undefined : activeFolder;

  const createFolder = () => {
    const name = newFolderName.trim();
    if (!name) return;
    const id = `f_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    persist({ ...data, folders: [...data.folders, { id, name, createdAt: new Date().toISOString() }] });
    setNewFolderName("");
    setFolderInputOpen(false);
  };

  const commitRenameFolder = () => {
    if (editingFolderId == null) return;
    const name = editingFolderName.trim();
    if (!name) {
      setEditingFolderId(null);
      return;
    }
    persist({
      ...data,
      folders: data.folders.map((f) => (f.id === editingFolderId ? { ...f, name } : f)),
    });
    setEditingFolderId(null);
  };

  const deleteFolder = (id: string) => {
    if (!window.confirm("Delete this folder? Its items move back to Unfiled (they are not removed).")) return;
    const devs = { ...data.devs };
    const repos = { ...data.repos };
    for (const k of Object.keys(devs)) if (devs[k].folderId === id) devs[k] = { ...devs[k], folderId: undefined };
    for (const k of Object.keys(repos)) if (repos[k].folderId === id) repos[k] = { ...repos[k], folderId: undefined };
    persist({ ...data, folders: data.folders.filter((f) => f.id !== id), devs, repos });
    if (activeFolder === id) setActiveFolder("all");
  };

  const setItemFolder = (kind: "dev" | "repo", id: string, folderId: string | undefined) => {
    if (kind === "dev") {
      const dev = data.devs[id];
      if (dev) persist({ ...data, devs: { ...data.devs, [id]: { ...dev, folderId } } });
    } else {
      const repo = data.repos[id];
      if (repo) persist({ ...data, repos: { ...data.repos, [id]: { ...repo, folderId } } });
    }
  };

  const folderMatch = (it: { folderId?: string }) => {
    if (activeFolder === "all") return true;
    if (activeFolder === "unfiled") return !it.folderId;
    return it.folderId === activeFolder;
  };

  const savePreset = (name: string) => {
    const preset: ViewPreset = {
      name,
      filter: ui.filter,
      view: ui.view,
      sort: ui.sort,
      group: ui.group,
      density: ui.density,
      langFilter: ui.langFilter,
      tagFilter: [...ui.tagFilter],
      hasNotesOnly: ui.hasNotesOnly,
    };
    const next = [...presets.filter((p) => p.name !== name), preset];
    setPresets(next);
    savePresets(next);
    setToast(`Saved view “${name}”`);
    setTimeout(() => setToast(""), 2500);
  };

  const applyPreset = (preset: ViewPreset) => {
    updateUI({
      filter: preset.filter,
      view: preset.view,
      sort: preset.sort,
      group: preset.group,
      density: preset.density,
      langFilter: preset.langFilter,
      tagFilter: [...preset.tagFilter],
      hasNotesOnly: preset.hasNotesOnly,
    });
  };

  const deletePreset = (name: string) => {
    const next = presets.filter((p) => p.name !== name);
    setPresets(next);
    savePresets(next);
  };

  const addDev = async (presetUsername?: string) => {
    const username = (presetUsername ?? newDev).trim().replace(/^@/, "");
    if (!username) return;
    if (data.devs[username]) return showError(`@${username} is already tracked`);

    setBusy((b) => ({ ...b, [`dev:${username}`]: true }));
    try {
      const res = await ghUser(username);
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Failed to fetch user");
      
      // Auto link to existing repos that were linked in pastLinks
      const existingPastLinksForDev = pastLinks.filter(
        p => p.dev === username && data.repos[p.repo]
      );
      const autoLinkedRepos = existingPastLinksForDev.map(p => p.repo);
      
      // Also update repos to link back to dev
      const nextRepos = { ...data.repos };
      for (const repoName of autoLinkedRepos) {
        if (!nextRepos[repoName].linkedDevs.includes(username)) {
          nextRepos[repoName] = {
            ...nextRepos[repoName],
            linkedDevs: [...nextRepos[repoName].linkedDevs, username]
          };
        }
      }
      
      const suggested = suggestDevTags(j, []);
      const next: DirectoryData = {
        ...data,
        devs: {
          ...data.devs,
          [username]: { ...j, tags: suggested, notes: "", linkedRepos: autoLinkedRepos, addedAt: new Date().toISOString(), folderId: activeFolderId }
        },
        repos: nextRepos
      };
      await persist(next);
      if (suggested.length) setToast(`@${username} added · auto-tags: ${suggested.join(", ")}`);
      setTimeout(() => setToast(""), 3000);
      setNewDev("");
    } catch (e: any) {
      showError(e.message);
    }
    setBusy((b) => ({ ...b, [`dev:${username}`]: false }));
  };

  const addRepo = async () => {
    const input = newRepo.trim().replace(/^https?:\/\/github\.com\//, "").replace(/\/$/, "");
    if (!input || !input.includes("/")) return showError('Use "owner/repo" format');
    if (data.repos[input]) return showError(`${input} is already tracked`);

    const [owner, repo] = input.split("/");
    setBusy((b) => ({ ...b, [`repo:${input}`]: true }));
    try {
      const res = await ghRepo(owner, repo);
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Failed to fetch repo");
      
      // Auto link to existing devs that were linked in pastLinks
      const existingPastLinksForRepo = pastLinks.filter(
        p => p.repo === j.fullName && data.devs[p.dev]
      );
      const autoLinkedDevs = existingPastLinksForRepo.map(p => p.dev);
      
      // Also update devs to link back to repo
      const nextDevs = { ...data.devs };
      for (const username of autoLinkedDevs) {
        if (!nextDevs[username].linkedRepos.includes(j.fullName)) {
          nextDevs[username] = {
            ...nextDevs[username],
            linkedRepos: [...nextDevs[username].linkedRepos, j.fullName]
          };
        }
      }
      
      const suggested = suggestRepoTags(j);
      const next: DirectoryData = {
        ...data,
        devs: nextDevs,
        repos: {
          ...data.repos,
          [j.fullName]: { ...j, tags: suggested, notes: "", linkedDevs: autoLinkedDevs, addedAt: new Date().toISOString(), folderId: activeFolderId }
        }
      };
      await persist(next);
      if (suggested.length) setToast(`${j.fullName} added · auto-tags: ${suggested.join(", ")}`);
      setTimeout(() => setToast(""), 3000);
      setNewRepo("");
    } catch (e: any) {
      showError(e.message);
    }
    setBusy((b) => ({ ...b, [`repo:${input}`]: false }));
  };

  const refreshDev = async (username: string) => {
    setBusy((b) => ({ ...b, [`dev:${username}`]: true }));
    try {
      const res = await ghUser(username);
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Failed to sync");
      const next = { ...data, devs: { ...data.devs, [username]: { ...data.devs[username], ...j } } };
      await persist(next);
    } catch (e: any) {
      showError(e.message);
    }
    setBusy((b) => ({ ...b, [`dev:${username}`]: false }));
  };

  const refreshRepo = async (fullName: string) => {
    const [owner, repo] = fullName.split("/");
    setBusy((b) => ({ ...b, [`repo:${fullName}`]: true }));
    try {
      const res = await ghRepo(owner, repo);
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Failed to sync");
      const next = { ...data, repos: { ...data.repos, [fullName]: { ...data.repos[fullName], ...j } } };
      await persist(next);
    } catch (e: any) {
      showError(e.message);
    }
    setBusy((b) => ({ ...b, [`repo:${fullName}`]: false }));
  };

  const refreshAll = async () => {
    for (const u of Object.keys(data.devs)) await refreshDev(u);
    for (const r of Object.keys(data.repos)) await refreshRepo(r);
  };

  const updateDev = (username: string, patch: Partial<Developer>) =>
    persist({ ...data, devs: { ...data.devs, [username]: { ...data.devs[username], ...patch } } });

  const updateRepo = (fullName: string, patch: Partial<Repo>) =>
    persist({ ...data, repos: { ...data.repos, [fullName]: { ...data.repos[fullName], ...patch } } });

  // Own profile (no login): define a username and upsert yourself as a Developer.
  const setMyProfile = async (username: string) => {
    const uname = username.trim().replace(/^@/, "");
    if (!uname) return;
    let next = data;
    if (myUsername && myUsername !== uname && next.devs[myUsername]?.isMe) {
      const prev = next.devs[myUsername];
      next = { ...next, devs: { ...next.devs, [myUsername]: { ...prev, isMe: false } } };
    }
    const existing = next.devs[uname];
    const merged: Developer = {
      username: uname,
      name: existing?.name ?? uname,
      avatar_url: existing?.avatar_url ?? null,
      bio: existing?.bio ?? null,
      followers: existing?.followers ?? null,
      location: existing?.location ?? null,
      tags: existing?.tags ?? [],
      notes: existing?.notes ?? "",
      linkedRepos: existing?.linkedRepos ?? [],
      lastSynced: existing?.lastSynced,
      addedAt: existing?.addedAt ?? new Date().toISOString(),
      isMe: true,
      stickyNotes: existing?.stickyNotes,
    };
    next = { ...next, devs: { ...next.devs, [uname]: merged } };
    persist(next);
    setMyUsernameState(uname);
    saveMyUsername(uname);
    setToast(`Profile set to @${uname}`);

    // Best-effort: enrich the profile with live GitHub data.
    try {
      const res = await ghUser(uname);
      if (res.ok) {
        const j = await res.json();
        persist({
          ...data,
          devs: {
            ...data.devs,
            [uname]: {
              ...merged,
              name: j.name ?? merged.name,
              avatar_url: j.avatar_url ?? merged.avatar_url,
              bio: j.bio ?? merged.bio,
              followers: j.followers ?? merged.followers,
              location: j.location ?? merged.location,
              lastSynced: new Date().toISOString(),
            },
          },
        });
      }
    } catch {
      /* offline — keep the placeholder profile */
    }
  };

  // Build a self-contained share link: the directory is encoded into the URL
  // fragment so anyone who opens it sees YOUR data — no backend, no 404s.
  const generateShareLink = () => {
    const handle = publishHandleInput.trim().replace(/^@/, "");
    setPublishing(true);
    setPublishError("");
    setPublishResult(null);
    try {
      const url = encodeShare(data.devs, data.repos, handle);
      savePublishHandle(handle);
      setPublishResult({ slug: handle || "link", url });
      navigator.clipboard?.writeText(`${window.location.origin}${url}`).catch(() => {});
      setToast("Share link copied & opened!");
      window.open(url, "_blank", "noopener");
    } catch (e: any) {
      setPublishError(e.message || "Could not build share link");
    } finally {
      setPublishing(false);
    }
  };

  // First, add state for tracking past links, to auto-reconnect later
  type PastLink = { 
    dev: string;
    repo: string;
  };
  
  // Load past links from localStorage
  const [pastLinks, setPastLinks] = useState<PastLink[]>(() => {
    try {
      const saved = localStorage.getItem("rues-past-links");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const deleteDev = (username: string) => {
    const dev = data.devs[username];
    // Pre-select no linked items for deletion
    setDeleteModal({
      type: "dev",
      username,
      linkedItemsToDelete: []
    });
  };

  const deleteRepo = (fullName: string) => {
    const repo = data.repos[fullName];
    // Pre-select no linked items for deletion
    setDeleteModal({
      type: "repo",
      fullName,
      linkedItemsToDelete: []
    });
  };
  
  const confirmDelete = () => {
    if (!deleteModal) return;
    
    // Save past links first
    const newPastLinks = [...pastLinks];
    
    if (deleteModal.type === "dev") {
      const dev = data.devs[deleteModal.username];
      const linkedRepos = (dev?.linkedRepos || []);
      for (const repo of linkedRepos) {
        if (!newPastLinks.find(p => p.dev === deleteModal.username && p.repo === repo)) {
          newPastLinks.push({ dev: deleteModal.username, repo });
        }
      }
      
      // Delete selected linked repos
      let reposToKeep = { ...data.repos };
      for (const repoName of deleteModal.linkedItemsToDelete) {
        delete reposToKeep[repoName];
        // Also save past links for any other devs linked to the deleted repo
        const repoData = data.repos[repoName];
        for (const linkedDev of (repoData?.linkedDevs || [])) {
          if (linkedDev !== deleteModal.username) {
            if (!newPastLinks.find(p => p.dev === linkedDev && p.repo === repoName)) {
              newPastLinks.push({ dev: linkedDev, repo: repoName });
            }
          }
        }
      }
      
      // Now, remove links from remaining repos
      reposToKeep = Object.fromEntries(
        Object.entries(reposToKeep).map(([k, r]) => [
          k,
          { ...r, linkedDevs: (r.linkedDevs || []).filter((u) => u !== deleteModal.username) }
        ])
      );
      
      // Delete dev
      const { [deleteModal.username]: _, ...restDevs } = data.devs;
      
      setPastLinks(newPastLinks);
      localStorage.setItem("rues-past-links", JSON.stringify(newPastLinks));
      
      persist({ devs: restDevs, repos: reposToKeep, folders: data.folders });
    } else {
      // repo deletion
      const repo = data.repos[deleteModal.fullName];
      const linkedDevs = (repo?.linkedDevs || []);
      for (const dev of linkedDevs) {
        if (!newPastLinks.find(p => p.dev === dev && p.repo === deleteModal.fullName)) {
          newPastLinks.push({ dev, repo: deleteModal.fullName });
        }
      }
      
      // Delete selected linked devs
      let devsToKeep = { ...data.devs };
      for (const username of deleteModal.linkedItemsToDelete) {
        delete devsToKeep[username];
        // Also save past links for other repos linked to deleted dev
        const devData = data.devs[username];
        for (const linkedRepo of (devData?.linkedRepos || [])) {
          if (linkedRepo !== deleteModal.fullName) {
            if (!newPastLinks.find(p => p.dev === username && p.repo === linkedRepo)) {
              newPastLinks.push({ dev: username, repo: linkedRepo });
            }
          }
        }
      }
      
      // Remove links from remaining devs
      devsToKeep = Object.fromEntries(
        Object.entries(devsToKeep).map(([k, d]) => [
          k,
          { ...d, linkedRepos: (d.linkedRepos || []).filter((r) => r !== deleteModal.fullName) }
        ])
      );
      
      // Delete repo
      const { [deleteModal.fullName]: _, ...restRepos } = data.repos;
      
      setPastLinks(newPastLinks);
      localStorage.setItem("rues-past-links", JSON.stringify(newPastLinks));
      
      persist({ devs: devsToKeep, repos: restRepos, folders: data.folders });
    }
    
    setDeleteModal(null);
  };

  const toggleLink = (username: string, fullName: string) => {
    const dev = data.devs[username];
    const repo = data.repos[fullName];
    if (!dev || !repo) return;
    const devHas = (dev.linkedRepos || []).includes(fullName);
    const nextDev = {
      ...dev,
      linkedRepos: devHas
        ? dev.linkedRepos.filter((r) => r !== fullName)
        : [...(dev.linkedRepos || []), fullName]
    };
    const nextRepo = {
      ...repo,
      linkedDevs: devHas
        ? repo.linkedDevs.filter((u) => u !== username)
        : [...(repo.linkedDevs || []), username]
    };
    persist({ devs: { ...data.devs, [username]: nextDev }, repos: { ...data.repos, [fullName]: nextRepo }, folders: data.folders });
  };

  const addReposBulk = (incoming: Repo[], username: string) => {
    const repos = { ...data.repos };
    const newRepoFullNames: string[] = [];
    for (const r of incoming) {
      if (!repos[r.fullName]) {
        repos[r.fullName] = r;
        newRepoFullNames.push(r.fullName);
      }
    }
    // Also update the dev's linkedRepos to include these new repos
    const dev = data.devs[username];
    const devs = { ...data.devs };
    if (dev) {
      devs[username] = {
        ...dev,
        linkedRepos: [...new Set([...(dev.linkedRepos || []), ...newRepoFullNames])],
      };
    }
    persist({ ...data, repos, devs });
  };

  const exportAll = () => {
    const parts = [
      `# Rues (ឫស) Export — ${new Date().toLocaleDateString()}`,
      "",
      "> Paste sections into Obsidian, or split by heading with the Note Composer plugin. Each section below is one note; the frontmatter block still applies once split out.",
      ""
    ];
    Object.values(data.devs).forEach((d) => parts.push(buildDevMarkdown(d), "\n---\n"));
    Object.values(data.repos).forEach((r) => parts.push(buildRepoMarkdown(r), "\n---\n"));
    downloadFile(`rues-${Date.now()}.md`, parts.join("\n"));
    setToast("Downloaded — drop it in your vault");
    setTimeout(() => setToast(""), 2500);
  };

  const exportAllMarkdown = () => {
    const parts = [
      `# Rues (ឫស) Export — ${new Date().toLocaleString()}`,
      "",
      `> ${Object.keys(data.devs).length} developers · ${Object.keys(data.repos).length} repositories. Standard Markdown (no Obsidian frontmatter).`,
      ""
    ];
    Object.values(data.devs).forEach((d) => parts.push(buildDevMarkdownMd(d), "\n---\n"));
    Object.values(data.repos).forEach((r) => parts.push(buildRepoMarkdownMd(r), "\n---\n"));
    downloadFile(`rues-markdown-${Date.now()}.md`, parts.join("\n"));
    setToast("Downloaded Markdown export");
    setTimeout(() => setToast(""), 2500);
  };

  // Since the directory now lives in this browser's localStorage rather than
  // on a server, backup/restore is how people move it between browsers or
  // devices, or protect against clearing site data.
  const exportBackup = () => {
    downloadFile(`rues-backup-${Date.now()}.json`, JSON.stringify(data, null, 2));
    setToast("Backup downloaded");
    setTimeout(() => setToast(""), 2500);
  };

  const exportMultiFile = async () => {
    if (!("showDirectoryPicker" in window)) {
      setToast("Multi-file export requires Chrome 86+ or Edge 86+");
      setTimeout(() => setToast(""), 3500);
      return;
    }
    try {
      const dir = await (window as any).showDirectoryPicker();
      const devDir = await dir.getDirectoryHandle("developers", { create: true });
      const repoDir = await dir.getDirectoryHandle("repositories", { create: true });
      for (const d of Object.values(data.devs)) {
        const f = await devDir.getFileHandle(`${d.username}.md`, { create: true });
        const w = await f.createWritable();
        await w.write(buildDevMarkdown(d));
        await w.close();
      }
      for (const r of Object.values(data.repos)) {
        const safeName = r.fullName.replace(/\//g, "_");
        const f = await repoDir.getFileHandle(`${safeName}.md`, { create: true });
        const w = await f.createWritable();
        await w.write(buildRepoMarkdown(r));
        await w.close();
      }
      setToast(`Exported ${Object.keys(data.devs).length + Object.keys(data.repos).length} files`);
    } catch (e: any) {
      if (e.name !== "AbortError" && e.name !== "SecurityError") {
        setToast("Export cancelled or failed");
      }
    }
    setTimeout(() => setToast(""), 2500);
  };

  const exportSubgraph = (ids: string[]) => {
    const items = idsToItems(ids);
    if (items.length === 0) return;
    const parts: string[] = [];
    items.filter((i) => i.kind === "dev").forEach((i) => parts.push(buildDevMarkdown(i.data as Developer), "\n---\n"));
    items.filter((i) => i.kind === "repo").forEach((i) => parts.push(buildRepoMarkdown(i.data as Repo), "\n---\n"));
    downloadFile(`rues-subgraph-${Date.now()}.md`, parts.join("\n"));
    setToast(`Exported ${items.length} subgraph items`);
    setTimeout(() => setToast(""), 2500);
  };

  const importBackup = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== "object" || !parsed.devs || !parsed.repos) {
        throw new Error("That doesn't look like a Rues (ឫស) backup file.");
      }
      const incomingDevs = Object.keys(parsed.devs).length;
      const incomingRepos = Object.keys(parsed.repos).length;
      const hasExisting = Object.keys(data.devs).length + Object.keys(data.repos).length > 0;
      if (
        hasExisting &&
        !window.confirm(
          `Import ${incomingDevs} developer(s) and ${incomingRepos} repo(s)? This replaces everything currently tracked in this browser.`
        )
      ) {
        return;
      }
      persist({ devs: parsed.devs, repos: parsed.repos, folders: Array.isArray(parsed.folders) ? parsed.folders : [] });
      setActiveFolder("all");
      setToast("Backup restored");
      setTimeout(() => setToast(""), 2500);
    } catch (e: any) {
      showError(e.message || "Couldn't read that file");
    }
  };

  const extractFromText = (text: string): { devs: string[]; repos: string[] } => {
    const devSet = new Set<string>();
    const repoSet = new Set<string>();

    // GitHub URLs: github.com/<user> or github.com/<owner>/<repo>
    const urlRe = /https?:\/\/(?:www\.)?github\.com\/([a-zA-Z0-9._-]+)(?:\/([a-zA-Z0-9._-]+)(?:\/.*)?)?/g;
    let m: RegExpExecArray | null;
    while ((m = urlRe.exec(text)) !== null) {
      if (m[2] && m[2].length > 0 && !m[2].match(/^(issues|pull|releases|actions|projects|wiki|settings|pulse|network|members|stars|forks|discussions|blob|tree|commit|raw)$/i)) {
        repoSet.add(`${m[1].toLowerCase()}/${m[2].toLowerCase()}`);
        devSet.add(m[1].toLowerCase());
      } else if (m[1]) {
        devSet.add(m[1].toLowerCase());
      }
    }

    // Frontmatter: github: <username> or repo: <owner/repo>
    const fmGithub = /^github:\s*(.+)$/gm;
    while ((m = fmGithub.exec(text)) !== null) {
      devSet.add(m[1].trim().toLowerCase());
    }
    const fmRepo = /^repo:\s*(.+)$/gm;
    while ((m = fmRepo.exec(text)) !== null) {
      repoSet.add(m[1].trim().toLowerCase());
    }

    // @username mentions
    const atRe = /@([a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38})/g;
    while ((m = atRe.exec(text)) !== null) {
      devSet.add(m[1].toLowerCase());
    }

    // [[slug]] — https://github.com/<owner>/<repo> (Obsidian export format)
    const linkRe = /\[\[([^\]]+)\]\]\s*—\s*https:\/\/github\.com\/([a-zA-Z0-9._-]+)(?:\/([a-zA-Z0-9._-]+))?/g;
    while ((m = linkRe.exec(text)) !== null) {
      if (m[3]) {
        repoSet.add(`${m[2].toLowerCase()}/${m[3].toLowerCase()}`);
        devSet.add(m[2].toLowerCase());
      } else {
        devSet.add(m[2].toLowerCase());
      }
    }

    return { devs: Array.from(devSet), repos: Array.from(repoSet) };
  };

  const runImport = async (text: string) => {
    setImportBusy(true);
    setImportResults([]);
    const results: string[] = [];
    const { devs, repos } = extractFromText(text);

    if (devs.length === 0 && repos.length === 0) {
      results.push("No GitHub usernames or repos found in that text.");
      setImportResults(results);
      setImportBusy(false);
      return;
    }

    results.push(`Found ${devs.length} developer(s) and ${repos.length} repo(s). Fetching data…`);
    setImportResults([...results]);

    // Phase 1: fetch all devs
    const fetchedDevs: Record<string, any> = {};
    for (const username of devs) {
      try {
        const res = await ghUser(username);
        const j = await res.json();
        if (!res.ok) throw new Error(j.error || "Not found");
        fetchedDevs[username] = j;
        results.push(`  📡 @${username} — fetched`);
      } catch (e: any) {
        results.push(`  ❌ @${username} — ${e.message}`);
      }
      setImportResults([...results]);
    }

    // Phase 2: fetch all repos
    const fetchedRepos: Record<string, any> = {};
    for (const fullName of repos) {
      const [owner, repo] = fullName.split("/");
      try {
        const res = await ghRepo(owner, repo);
        const j = await res.json();
        if (!res.ok) throw new Error(j.error || "Not found");
        fetchedRepos[j.fullName] = j;
        results.push(`  📡 ${fullName} — fetched`);
      } catch (e: any) {
        results.push(`  ❌ ${fullName} — ${e.message}`);
      }
      setImportResults([...results]);
    }

    // Build case-insensitive lookup for existing repo keys
    const repoKeyByLower = new Map<string, string>();
    for (const k of Object.keys(data.repos)) repoKeyByLower.set(k.toLowerCase(), k);

    // Phase 3: merge fetched data into next, preserving local tags/notes
    let next = { ...data };
    let changed = false;

    for (const username of Object.keys(fetchedDevs)) {
      const j = fetchedDevs[username];
      if (next.devs[username]) {
        const existing = next.devs[username];
        next = {
          ...next,
          devs: {
            ...next.devs,
            [username]: { ...j, tags: existing.tags, notes: existing.notes, linkedRepos: existing.linkedRepos, addedAt: existing.addedAt }
          }
        };
        results.push(`  🔄 @${username} — updated`);
      } else {
        next = { ...next, devs: { ...next.devs, [username]: { ...j, tags: [], notes: "", linkedRepos: [], addedAt: new Date().toISOString() } } };
        results.push(`  ✅ @${username} — added`);
      }
      changed = true;
      setImportResults([...results]);
    }

    for (const fullName of Object.keys(fetchedRepos)) {
      const j = fetchedRepos[fullName];
      // Use the existing key (preserving original casing) if it differs only by case
      const existingKey = repoKeyByLower.get(fullName.toLowerCase());
      if (existingKey && next.repos[existingKey]) {
        const existing = next.repos[existingKey];
        next = {
          ...next,
          repos: {
            ...next.repos,
            [existingKey]: { ...j, tags: existing.tags, notes: existing.notes, linkedDevs: existing.linkedDevs, addedAt: existing.addedAt }
          }
        };
        results.push(`  🔄 ${fullName} → updated (${existingKey})`);
      } else {
        next = { ...next, repos: { ...next.repos, [fullName]: { ...j, tags: [], notes: "", linkedDevs: [], addedAt: new Date().toISOString() } } };
        results.push(`  ✅ ${fullName} — added`);
      }
      changed = true;
      setImportResults([...results]);
    }

    // Phase 4: bidirectional linking — connect every dev to repos they own
    const devPatches: Record<string, string[]> = {};
    const repoPatches: Record<string, string[]> = {};
    for (const username of Object.keys(next.devs)) {
      const d = next.devs[username];
      const prefix = username.toLowerCase() + "/";
      for (const rFull of Object.keys(next.repos)) {
        if (!rFull.toLowerCase().startsWith(prefix)) continue;
        if (!d.linkedRepos.includes(rFull)) {
          (devPatches[username] ||= []).push(rFull);
        }
        const r = next.repos[rFull];
        if (!r.linkedDevs.includes(username)) {
          (repoPatches[rFull] ||= []).push(username);
        }
      }
    }
    if (Object.keys(devPatches).length || Object.keys(repoPatches).length) {
      let d2 = next.devs;
      for (const [u, add] of Object.entries(devPatches)) {
        d2 = { ...d2, [u]: { ...next.devs[u], linkedRepos: [...next.devs[u].linkedRepos, ...add] } };
      }
      let r2 = next.repos;
      for (const [f, add] of Object.entries(repoPatches)) {
        r2 = { ...r2, [f]: { ...next.repos[f], linkedDevs: [...next.repos[f].linkedDevs, ...add] } };
      }
      next = { ...next, devs: d2, repos: r2 };
      changed = true;
    }

    if (changed) {
      await persist(next);
      results.push("Done — items saved and linked.");
    } else {
      results.push("Nothing new to add.");
    }
    setImportResults([...results]);
    setImportBusy(false);
  };

  const handleImportFile = async (file: File) => {
    try {
      const text = await file.text();
      setImportText(text);
      setShowImportModal(true);
    } catch (e: any) {
      showError("Couldn't read that file.");
    }
  };

  const importStarred = async () => {
    const username = starredUser.trim().replace(/^@/, "");
    if (!username) return;
    setImportBusy(true);
    setImportResults([`Fetching @${username}'s starred repos…`]);
    try {
      const res = await ghStarred(username);
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Failed to fetch stars");
      const repos: string[] = j.repos || [];
      if (repos.length === 0) {
        setImportResults(["No starred repos found (or they're private)."]);
      } else {
        // Reuse the import pipeline by feeding the full_name list as text.
        await runImport(repos.map((r) => `https://github.com/${r}`).join("\n"));
      }
    } catch (e: any) {
      setImportResults([`❌ ${e.message}`]);
    }
    setImportBusy(false);
  };

  // Bulk operations ---------------------------------------------------------
  const idsToItems = (ids: Iterable<string>): Item[] => {
    const out: Item[] = [];
    for (const id of ids) {
      if (id.startsWith("dev:")) {
        const u = id.slice(4);
        if (data.devs[u]) out.push({ kind: "dev", id, data: data.devs[u] });
      } else if (id.startsWith("repo:")) {
        const f = id.slice(5);
        if (data.repos[f]) out.push({ kind: "repo", id, data: data.repos[f] });
      }
    }
    return out;
  };

  const deleteSelected = () => {
    const items = idsToItems(selected);
    if (items.length === 0) return;
    if (!window.confirm(`Remove ${items.length} item(s) from tracking?`)) return;
    let next = data;
    for (const it of items) {
      if (it.kind === "dev") {
        const { [it.data.username]: _, ...restDevs } = next.devs;
        const repos = Object.fromEntries(
          Object.entries(next.repos).map(([k, r]) => [
            k,
            { ...r, linkedDevs: (r.linkedDevs || []).filter((u) => u !== it.data.username) }
          ])
        );
        next = { devs: restDevs, repos, folders: next.folders };
      } else {
        const { [it.data.fullName]: _, ...restRepos } = next.repos;
        const devs = Object.fromEntries(
          Object.entries(next.devs).map(([k, d]) => [
            k,
            { ...d, linkedRepos: (d.linkedRepos || []).filter((r) => r !== it.data.fullName) }
          ])
        );
        next = { devs, repos: restRepos, folders: next.folders };
      }
    }
    persist(next);
    setSelected(new Set());
    setSelectMode(false);
    setToast(`Removed ${items.length} item(s)`);
    setTimeout(() => setToast(""), 2500);
  };

  const tagSelected = () => {
    const tags = bulkTag
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    if (tags.length === 0) return;
    let next = data;
    for (const id of selected) {
      if (id.startsWith("dev:")) {
        const u = id.slice(4);
        const dev = next.devs[u];
        if (!dev) continue;
        const merged = Array.from(new Set([...(dev.tags || []), ...tags]));
        next = { ...next, devs: { ...next.devs, [u]: { ...dev, tags: merged } } };
      } else if (id.startsWith("repo:")) {
        const f = id.slice(5);
        const repo = next.repos[f];
        if (!repo) continue;
        const merged = Array.from(new Set([...(repo.tags || []), ...tags]));
        next = { ...next, repos: { ...next.repos, [f]: { ...repo, tags: merged } } };
      }
    }
    persist(next);
    setBulkTag("");
    setToast(`Tagged ${selected.size} item(s)`);
    setTimeout(() => setToast(""), 2500);
  };

  const exportSelected = () => {
    const items = idsToItems(selected);
    if (items.length === 0) return;
    const parts: string[] = [];
    items
      .filter((i) => i.kind === "dev")
      .forEach((i) => parts.push(buildDevMarkdown(i.data as Developer), "\n---\n"));
    items
      .filter((i) => i.kind === "repo")
      .forEach((i) => parts.push(buildRepoMarkdown(i.data as Repo), "\n---\n"));
    downloadFile(`dev-directory-selection-${Date.now()}.md`, parts.join("\n"));
    setToast(`Exported ${items.length} item(s)`);
    setTimeout(() => setToast(""), 2500);
  };

  const q = query.toLowerCase();
  const matches = (text: string) => !q || text.toLowerCase().includes(q);

  const devItems: Item[] = Object.values(data.devs)
    .filter((d) => (ui.filter === "all" || ui.filter === "devs") && folderMatch(d) && matches(d.username + (d.name || "") + (d.tags || []).join(" ")))
    .map((d) => ({ kind: "dev" as const, id: `dev:${d.username}`, data: d }));
  const repoItems: Item[] = Object.values(data.repos)
    .filter(
      (r) =>
        (ui.filter === "all" || ui.filter === "repos") &&
        folderMatch(r) &&
        matches(r.fullName + (r.description || "") + (r.tags || []).join(" "))
    )
    .map((r) => ({ kind: "repo" as const, id: `repo:${r.fullName}`, data: r }));

  let items: Item[] = [...devItems, ...repoItems];
  items = items.filter((it) => {
    if (ui.langFilter && it.kind === "repo" && (it.data.language || "") !== ui.langFilter) return false;
    if (ui.tagFilter.length && !(it.data.tags || []).some((t) => ui.tagFilter.includes(t))) return false;
    if (ui.hasNotesOnly && !(it.data.notes || "").trim()) return false;
    return true;
  });
  items = sortItems(items, ui.sort);

  const graphItems: Item[] = useMemo(() => [
    ...(ui.filter === "all" || ui.filter === "devs" ? Object.values(data.devs).filter(folderMatch).map((d) => ({ kind: "dev" as const, id: `dev:${d.username}`, data: d })) : []),
    ...(ui.filter === "all" || ui.filter === "repos" ? Object.values(data.repos).filter(folderMatch).map((r) => ({ kind: "repo" as const, id: `repo:${r.fullName}`, data: r })) : []),
  ], [data.devs, data.repos, ui.filter, activeFolder]);

  const allLanguages = useMemo(
    () =>
      Array.from(
        new Set(Object.values(data.repos).map((r) => r.language).filter(Boolean) as string[])
      ).sort(),
    [data.repos]
  );
  const allTags = useMemo(
    () =>
      Array.from(
        new Set([
          ...Object.values(data.devs).flatMap((d) => d.tags || []),
          ...Object.values(data.repos).flatMap((r) => r.tags || [])
        ])
      ).sort(),
    [data]
  );

  if (!loaded) {
    return (
      <div className="flex h-64 items-center justify-center text-[var(--text-3)]">
        <Loader2 className="animate-spin" size={20} />
      </div>
    );
  }

  const activeFilterCount =
    (ui.langFilter ? 1 : 0) + ui.tagFilter.length + (ui.hasNotesOnly ? 1 : 0);

  const compact = ui.density === "compact";
  const gap = compact ? 8 : 16;

  const renderItem = (it: Item) =>
    it.kind === "dev" ? (
      <DevCard
        dev={it.data as Developer}
        allRepos={data.repos}
        onUpdate={updateDev}
        onDelete={deleteDev}
        onRefresh={refreshDev}
        onLink={toggleLink}
        refreshing={!!busy[`dev:${it.data.username}`]}
        setToast={setToast}
        compact={compact}
        variant={ui.view === "grid" ? "grid" : "list"}
        selectable={selectMode}
        selected={selected.has(it.id)}
        onToggleSelect={() =>
          setSelected((s) => {
            const n = new Set(s);
            if (n.has(it.id)) n.delete(it.id);
            else n.add(it.id);
            return n;
          })
        }
        onBrowse={browsing === null ? () => setBrowsing(it.data.username) : undefined}
        folders={data.folders}
        onSetFolder={(folderId) => setItemFolder("dev", it.data.username, folderId)}
      />
    ) : (
      <RepoCard
        repo={it.data as Repo}
        allDevs={data.devs}
        onUpdate={updateRepo}
        onDelete={deleteRepo}
        onRefresh={refreshRepo}
        onLink={toggleLink}
        refreshing={!!busy[`repo:${it.data.fullName}`]}
        setToast={setToast}
        compact={compact}
        variant={ui.view === "grid" ? "grid" : "list"}
        selectable={selectMode}
        selected={selected.has(it.id)}
        onToggleSelect={() =>
          setSelected((s) => {
            const n = new Set(s);
            if (n.has(it.id)) n.delete(it.id);
            else n.add(it.id);
            return n;
          })
        }
        folders={data.folders}
        onSetFolder={(folderId) => setItemFolder("repo", it.data.fullName, folderId)}
      />
    );

  const useVirtual = ui.view === "list" && ui.group === "none" && items.length > VIRTUALIZE_THRESHOLD;

  const vGridClass =
    "bento-grid columns-1 min-[480px]:columns-2 lg:columns-3 xl:columns-4 2xl:columns-5 3xl:columns-6 gap-4 [&>*]:break-inside-avoid [&>*]:mb-4 [&>*]:bento-item";

  return (
    <div className="min-h-full w-full bg-[var(--bg)] text-[var(--text)]">
      <div className="mx-auto w-full px-5 py-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[var(--text-3)]">
              <GitCommit size={14} />
              <span className="font-mono text-[11px] uppercase tracking-wider">git log --graph --devs</span>
            </div>
            <h1 className="font-display mt-1 text-[26px] font-bold tracking-tight">
              Rues (<span className="font-khmer">ឫស</span>)
              <span className={`ml-2 inline-block align-middle text-[10px] font-normal transition-opacity duration-300 ${saving ? "opacity-100" : "opacity-0"}`}>
                <span className="flex items-center gap-1 rounded-full bg-[var(--mint-bg)] px-2 py-0.5 text-[var(--mint-text)]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--mint-text)]" /> saved
                </span>
              </span>
            </h1>
            <p className="mt-1 text-[13px] text-[var(--text-2)]">
              {Object.keys(data.devs).length} developers · {Object.keys(data.repos).length} projects tracked
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={refreshAll}
              className="flex items-center gap-1.5 rounded-md border border-[var(--border)] px-3 py-1.5 text-[12px] text-[var(--text-soft)] hover:border-[var(--mint-text)] hover:text-[var(--mint-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--mint-text)]"
            >
              <RefreshCw size={13} /> Sync all
            </button>
            <button
              onClick={() => setTheme((t) => t === "dark" ? "angkor" : t === "angkor" ? "mekong" : t === "mekong" ? "light" : "dark")}
              title={`Theme: ${theme} (T)`}
              aria-label={`Current theme: ${theme}`}
              className="flex items-center justify-center rounded-md border border-[var(--border)] px-2.5 py-1.5 text-[var(--text-3)] hover:border-[var(--violet-text)] hover:text-[var(--violet-text)]"
            >
              {theme === "dark" ? <Moon size={13} /> : theme === "angkor" ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg> : theme === "mekong" ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12h20M12 2v20"/><circle cx="12" cy="12" r="10"/></svg> : <Sun size={13} />}
            </button>
            <span className="h-5 w-px bg-[var(--border)]" />
            <button
              onClick={undo}
              disabled={historyIdx <= 0}
              title="Undo (Ctrl+Z)"
              className="flex items-center justify-center rounded-md border border-[var(--border)] px-2 py-1.5 text-[var(--text-3)] hover:border-[var(--violet-text)] hover:text-[var(--violet-text)] disabled:opacity-30"
            >
              ↶
            </button>
            <button
              onClick={redo}
              disabled={historyIdx >= historyRef.current.length - 1}
              title="Redo (Ctrl+Shift+Z)"
              className="flex items-center justify-center rounded-md border border-[var(--border)] px-2 py-1.5 text-[var(--text-3)] hover:border-[var(--violet-text)] hover:text-[var(--violet-text)] disabled:opacity-30"
            >
              ↷
            </button>
            <Dropdown
              title="Data & export"
              trigger={
                <>
                  <Download size={13} /> Data
                </>
              }
            >
              {(close) => (
                <>
                  <button
                    onClick={() => {
                      exportAll();
                      close();
                    }}
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[12px] text-[var(--text-soft)] hover:bg-[var(--surface-2)]"
                  >
                    <Download size={13} className="text-[var(--violet-text)]" /> Export to Obsidian (single file)
                  </button>
                  <button
                    onClick={() => {
                      exportAllMarkdown();
                      close();
                    }}
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[12px] text-[var(--text-soft)] hover:bg-[var(--surface-2)]"
                  >
                    <Download size={13} className="text-[var(--mint-text)]" /> Export as Markdown (.md)
                  </button>
                  <button
                    onClick={() => {
                      exportMultiFile();
                      close();
                    }}
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[12px] text-[var(--text-soft)] hover:bg-[var(--surface-2)]"
                  >
                    <Download size={13} className="text-[var(--mint-text)]" /> Export (multi-file)
                  </button>
                  <button
                    onClick={() => {
                      exportBackup();
                      close();
                    }}
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[12px] text-[var(--text-soft)] hover:bg-[var(--surface-2)]"
                  >
                    <Download size={13} className="text-[var(--amber-text)]" /> Backup (JSON)
                  </button>
                  <button
                    onClick={() => {
                      importInputRef.current?.click();
                      close();
                    }}
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[12px] text-[var(--text-soft)] hover:bg-[var(--surface-2)]"
                  >
                    <Upload size={13} className="text-[var(--amber-text)]" /> Restore (JSON)
                  </button>
                  <button
                    onClick={() => {
                      setPublishHandleInput(loadPublishHandle() || myUsername || "");
                      setPublishOpen(true);
                      close();
                    }}
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[12px] text-[var(--text-soft)] hover:bg-[var(--surface-2)]"
                  >
                    <Upload size={13} className="text-[var(--mint-text)]" /> Publish / Share page
                  </button>
                  <button
                    onClick={() => {
                      setMyProfileInput(myUsername || "");
                      setMyProfileOpen(true);
                      close();
                    }}
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[12px] text-[var(--text-soft)] hover:bg-[var(--surface-2)]"
                  >
                    <UserCircle size={13} className="text-[var(--violet-text)]" /> {myUsername ? `My profile (@${myUsername})` : "Set my profile"}
                  </button>
                </>
              )}
            </Dropdown>
            <input
              ref={importInputRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) importBackup(file);
                e.target.value = "";
              }}
            />
          </div>
        </div>

        <p className="mt-3 text-[11px] text-[var(--text-3)]">
          Tracked developers and repos are saved in this browser only (localStorage) — use{" "}
          <strong className="text-[var(--text-2)]">Backup</strong> / <strong className="text-[var(--text-2)]">Restore</strong> to
          move your directory between browsers or devices. 
        </p>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-md border border-[var(--danger-border)] bg-[var(--danger-bg)] px-3 py-2 text-[12px] text-[var(--danger-text)]">
            <AlertCircle size={13} /> {error}
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
            <User size={14} className="text-[var(--violet-text)]" />
            <input
              value={newDev}
              onChange={(e) => setNewDev(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addDev()}
              placeholder="github username"
              aria-label="GitHub username to track"
              className="flex-1 bg-transparent text-[12px] text-[var(--text)] outline-none placeholder-[var(--placeholder)]"
            />
            <button
              onClick={() => addDev()}
              disabled={busy[`dev:${newDev.trim()}`]}
              aria-label="Add developer"
              className="text-[var(--mint-text)] hover:text-[var(--mint-text-hover)] disabled:opacity-50"
            >
              {busy[`dev:${newDev.trim()}`] ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
            </button>
          </div>
          <div className="flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
            <FolderGit2 size={14} className="text-[var(--mint-text)]" />
            <input
              value={newRepo}
              onChange={(e) => setNewRepo(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addRepo()}
              placeholder="owner/repo"
              aria-label="Repo to track, in owner/repo format"
              className="flex-1 bg-transparent text-[12px] text-[var(--text)] outline-none placeholder-[var(--placeholder)]"
            />
            <button
              onClick={addRepo}
              disabled={busy[`repo:${newRepo.trim()}`]}
              aria-label="Add repo"
              className="text-[var(--mint-text)] hover:text-[var(--mint-text-hover)] disabled:opacity-50"
            >
              {busy[`repo:${newRepo.trim()}`] ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
            </button>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-1.5 rounded-md border border-dashed border-[var(--border)] px-3 py-1.5 text-[11px] text-[var(--text-3)] hover:border-[var(--violet-text)] hover:text-[var(--violet-text)]"
          >
            <Link size={12} /> Import from URL / .md
          </button>
          <input
            ref={importMdInputRef}
            type="file"
            accept=".md,text/markdown"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImportFile(file);
              e.target.value = "";
            }}
          />
        </div>

        {showImportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xl">
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                <h2 className="font-display text-lg font-semibold text-[var(--text)]">Import</h2>
                <button onClick={() => { setShowImportModal(false); setImportText(""); setImportResults([]); }} className="rounded p-1 text-[var(--text-3)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]">
                  <X size={18} />
                </button>
              </div>
              <div className="mt-3 space-y-3">
                <textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder={`Paste GitHub URLs, @usernames, or owner/repo here…\n\ne.g.\nhttps://github.com/facebook\nhttps://github.com/facebook/react\n@someuser\nowner/repo\n\nOr paste the contents of an exported .md file.`}
                  className="w-full rounded border border-[var(--border)] bg-[var(--bg)] p-2 text-[12px] text-[var(--text)] outline-none placeholder-[var(--placeholder)] resize-none"
                  rows={6}
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => runImport(importText)}
                    disabled={importBusy || !importText.trim()}
                    className="flex items-center gap-1.5 rounded-md border border-[var(--violet-text)] px-3 py-1.5 text-[12px] text-[var(--violet-text)] hover:bg-[var(--violet-text)] hover:text-white disabled:opacity-40"
                  >
                    {importBusy ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
                    {importBusy ? "Importing…" : "Import & Fetch"}
                  </button>
                  <button
                    onClick={() => importMdInputRef.current?.click()}
                    className="flex items-center gap-1.5 rounded-md border border-[var(--border)] px-3 py-1.5 text-[12px] text-[var(--text-3)] hover:border-[var(--mint-text)] hover:text-[var(--mint-text)]"
                  >
                    <Upload size={13} /> Upload .md file
                  </button>
                </div>
                <div className="flex items-center gap-2 border-t border-[var(--border)] pt-3">
                  <input
                    value={starredUser}
                    onChange={(e) => setStarredUser(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && importStarred()}
                    placeholder="github username"
                    className="flex-1 rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-[12px] text-[var(--text)] outline-none placeholder-[var(--placeholder)]"
                  />
                  <button
                    onClick={importStarred}
                    disabled={importBusy || !starredUser.trim()}
                    className="flex items-center gap-1.5 rounded-md border border-[var(--mint-text)] px-3 py-1.5 text-[12px] text-[var(--mint-text)] hover:bg-[var(--mint-text)] hover:text-white disabled:opacity-40"
                  >
                    {importBusy ? <Loader2 size={13} className="animate-spin" /> : <Star size={13} />}
                    Import ⭐
                  </button>
                </div>
                {importResults.length > 0 && (
                  <div className="max-h-40 overflow-y-auto rounded border border-[var(--border)] bg-[var(--bg)] p-2 font-mono text-[11px] leading-relaxed text-[var(--text-2)]">
                    {importResults.map((line, i) => (
                      <div key={i}>{line}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {myProfileOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xl">
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                <h2 className="font-display text-lg font-semibold text-[var(--text)]">My profile</h2>
                <button
                  onClick={() => setMyProfileOpen(false)}
                  className="rounded p-1 text-[var(--text-3)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="mt-3 space-y-3 text-[12px] text-[var(--text-2)]">
                <p>
                  No login needed. Define your GitHub username and Rues will track you like any other
                  developer, so you can see your own full profile alongside the devs you follow.
                </p>
                <input
                  value={myProfileInput}
                  onChange={(e) => setMyProfileInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (setMyProfile(myProfileInput), setMyProfileOpen(false))}
                  placeholder="github username (e.g. im4tta)"
                  className="w-full rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[13px] text-[var(--text)] outline-none placeholder-[var(--placeholder)]"
                />
              </div>
              <div className="mt-4 flex items-center justify-end gap-2 border-t border-[var(--border)] pt-3">
                {myUsername && (
                  <button
                    onClick={() => {
                      if (data.devs[myUsername]?.isMe) {
                        persist({
                          ...data,
                          devs: { ...data.devs, [myUsername]: { ...data.devs[myUsername], isMe: false } },
                        });
                      }
                      setMyProfileInput("");
                      setMyUsernameState("");
                      saveMyUsername("");
                      setMyProfileOpen(false);
                    }}
                    className="mr-auto rounded-md px-3 py-1.5 text-[12px] text-[var(--text-3)] hover:text-[var(--rose-text)]"
                  >
                    Clear profile
                  </button>
                )}
                <button
                  onClick={() => { setMyProfile(myProfileInput); setMyProfileOpen(false); }}
                  disabled={!myProfileInput.trim()}
                  className="rounded-md border border-[var(--violet-text)] px-3 py-1.5 text-[12px] text-[var(--violet-text)] hover:bg-[var(--violet-text)] hover:text-white disabled:opacity-40"
                >
                  Save profile
                </button>
              </div>
            </div>
          </div>
        )}

        {publishOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xl">
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                <h2 className="font-display text-lg font-semibold text-[var(--text)]">Publish directory</h2>
                <button
                  onClick={() => { setPublishOpen(false); setPublishError(""); setPublishResult(null); }}
                  className="rounded p-1 text-[var(--text-3)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="mt-3 space-y-3 text-[12px] text-[var(--text-2)]">
                <p>
                  The entire directory is packed into the link itself, so anyone who opens it sees{" "}
                  <strong>your</strong> data — no login, no server, no &ldquo;doesn&rsquo;t exist&rdquo; error.
                  It&rsquo;s also copied to your clipboard.
                </p>
                <input
                  value={publishHandleInput}
                  onChange={(e) => setPublishHandleInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && generateShareLink()}
                  placeholder="label (optional, e.g. im4tta)"
                  className="w-full rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[13px] text-[var(--text)] outline-none placeholder-[var(--placeholder)]"
                />
                {publishError && <p className="text-[12px] text-[var(--rose-text)]">{publishError}</p>}
                {publishResult && (
                  <p className="text-[12px] text-[var(--mint-text)]">
                    Link ready — <a href={publishResult.url} target="_blank" rel="noopener" className="underline">open it</a>
                  </p>
                )}
              </div>
              <div className="mt-4 flex items-center justify-end gap-2 border-t border-[var(--border)] pt-3">
                <button
                  onClick={() => { setPublishOpen(false); setPublishError(""); setPublishResult(null); }}
                  className="rounded-md px-3 py-1.5 text-[12px] text-[var(--text-3)] hover:text-[var(--text)]"
                >
                  Cancel
                </button>
                <button
                  onClick={generateShareLink}
                  disabled={publishing}
                  className="flex items-center gap-1.5 rounded-md border border-[var(--mint-text)] px-3 py-1.5 text-[12px] text-[var(--mint-text)] hover:bg-[var(--mint-text)] hover:text-white disabled:opacity-40"
                >
                  {publishing ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                  {publishing ? "Building…" : "Copy share link"}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Folder
            size={13}
            className="mr-1 shrink-0 text-[var(--text-3)]"
          />
          <span className="mr-1 font-mono text-[11px] uppercase tracking-wider text-[var(--text-3)]">folders</span>
          <button
            onClick={() => setActiveFolder("all")}
            className={`rounded-full px-2.5 py-1 text-[12px] ${
              activeFolder === "all"
                ? "bg-[var(--violet-text)] text-white"
                : "border border-[var(--border)] text-[var(--text-2)] hover:border-[var(--violet-border)] hover:text-[var(--violet-text)]"
            }`}
          >
            All
          </button>
          {data.folders.map((f) => {
            const editing = editingFolderId === f.id;
            const active = activeFolder === f.id;
            if (editing) {
              return (
                <input
                  key={f.id}
                  autoFocus
                  value={editingFolderName}
                  onChange={(e) => setEditingFolderName(e.target.value)}
                  onBlur={commitRenameFolder}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRenameFolder();
                    if (e.key === "Escape") setEditingFolderId(null);
                  }}
                  className="w-28 rounded-full border border-[var(--violet-border)] bg-[var(--surface-input)] px-2.5 py-1 text-[12px] text-[var(--text)] outline-none"
                />
              );
            }
            return (
              <span key={f.id} className="group relative inline-flex items-center">
                <button
                  onClick={() => setActiveFolder(f.id)}
                  className={`rounded-full px-2.5 py-1 text-[12px] ${
                    active
                      ? "bg-[var(--violet-text)] text-white"
                      : "border border-[var(--border)] text-[var(--text-2)] hover:border-[var(--violet-border)] hover:text-[var(--violet-text)]"
                  }`}
                >
                  {f.name}
                </button>
                <button
                  onClick={() => {
                    setEditingFolderId(f.id);
                    setEditingFolderName(f.name);
                  }}
                  title="Rename folder"
                  aria-label={`Rename folder ${f.name}`}
                  className="ml-0.5 hidden rounded p-0.5 text-[var(--text-3)] hover:text-[var(--violet-text)] group-hover:inline-flex"
                >
                  <Pencil size={11} />
                </button>
                <button
                  onClick={() => deleteFolder(f.id)}
                  title="Delete folder"
                  aria-label={`Delete folder ${f.name}`}
                  className="rounded p-0.5 text-[var(--text-3)] hover:text-[var(--danger-text-hover)] group-hover:inline-flex"
                >
                  <X size={12} />
                </button>
              </span>
            );
          })}
          {folderInputOpen ? (
            <input
              autoFocus
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onBlur={() => {
                if (!newFolderName.trim()) setFolderInputOpen(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") createFolder();
                if (e.key === "Escape") {
                  setNewFolderName("");
                  setFolderInputOpen(false);
                }
              }}
              placeholder="folder name…"
              className="w-32 rounded-full border border-[var(--violet-border)] bg-[var(--surface-input)] px-2.5 py-1 text-[12px] text-[var(--text)] outline-none placeholder-[var(--placeholder)]"
            />
          ) : (
            <button
              onClick={() => setFolderInputOpen(true)}
              className="rounded-full border border-dashed border-[var(--border)] px-2.5 py-1 text-[12px] text-[var(--text-3)] hover:border-[var(--violet-border)] hover:text-[var(--violet-text)]"
            >
              + New
            </button>
          )}
          {data.folders.length > 0 && (
            <button
              onClick={() => setActiveFolder("unfiled")}
              className={`rounded-full px-2.5 py-1 text-[12px] ${
                activeFolder === "unfiled"
                  ? "bg-[var(--surface-2)] text-[var(--text)]"
                  : "text-[var(--text-3)] hover:text-[var(--text-2)]"
              }`}
            >
              Unfiled
            </button>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <div className="flex flex-1 items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5">
            <Search size={13} className="text-[var(--text-3)]" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="search name, username, repo, tag…  (press /)"
              aria-label="Search developers and repos"
              className="flex-1 bg-transparent text-[12px] text-[var(--text)] outline-none placeholder-[var(--placeholder)]"
            />
          </div>
          <div className="flex rounded-md border border-[var(--border)] p-0.5 font-mono text-[11px]">
            {(["all", "devs", "repos"] as const).map((f) => (
              <button
                key={f}
                onClick={() => updateUI({ filter: f })}
                aria-pressed={ui.filter === f}
                className={`rounded px-2.5 py-1 ${ui.filter === f ? "bg-[var(--surface-2)] text-[var(--text)]" : "text-[var(--text-3)]"}`}
              >
                {f}
              </button>
            ))}
          </div>
          <Dropdown
            title="Display options"
            trigger={
              <>
                <SlidersHorizontal size={13} /> Display
              </>
            }
          >
            {(close) => (
              <>
                <MenuGroup label="Sort">
                  {(["lastSynced", "addedAt", "name", "stars"] as const).map((s) => (
                    <SegBtn
                      key={s}
                      active={ui.sort === s}
                      onClick={() => {
                        updateUI({ sort: s });
                        close();
                      }}
                    >
                      {s === "lastSynced" ? "synced" : s === "addedAt" ? "added" : s}
                    </SegBtn>
                  ))}
                </MenuGroup>
                <MenuGroup label="Group">
                  {(["none", "tag", "linked"] as const).map((g) => (
                    <SegBtn
                      key={g}
                      active={ui.group === g}
                      onClick={() => {
                        updateUI({ group: g });
                        close();
                      }}
                    >
                      {g}
                    </SegBtn>
                  ))}
                </MenuGroup>
                <MenuGroup label="Density">
                  <SegBtn
                    active={!compact}
                    onClick={() => {
                      updateUI({ density: "comfortable" });
                      close();
                    }}
                  >
                    cozy
                  </SegBtn>
                  <SegBtn
                    active={compact}
                    onClick={() => {
                      updateUI({ density: "compact" });
                      close();
                    }}
                  >
                    compact
                  </SegBtn>
                </MenuGroup>
                <MenuGroup label="Layout">
                  <SegBtn
                    active={ui.view === "list"}
                    onClick={() => {
                      updateUI({ view: "list" });
                      close();
                    }}
                  >
                    list
                  </SegBtn>
                  <SegBtn
                    active={ui.view === "grid"}
                    onClick={() => {
                      updateUI({ view: "grid" });
                      close();
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="inline-block align-text-bottom"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg> grid
                  </SegBtn>
                  <SegBtn
                    active={ui.view === "graph"}
                    onClick={() => {
                      updateUI({ view: "graph" });
                      close();
                    }}
                  >
                    graph
                  </SegBtn>
                  <SegBtn
                    active={ui.view === "insights"}
                    onClick={() => {
                      updateUI({ view: "insights" });
                      close();
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="inline-block align-text-bottom"><path d="M3 3v18h18"/><path d="M7 15l3-4 3 3 4-6"/></svg> insights
                  </SegBtn>
                </MenuGroup>
                <MenuGroup label="Saved views">
                  {presets.length === 0 && (
                    <span className="block px-1 py-1 text-[11px] text-[var(--text-3)]">No saved views yet</span>
                  )}
                  {presets.map((p) => (
                    <div key={p.name} className="flex items-center justify-between gap-1 rounded px-1 py-0.5 hover:bg-[var(--surface-2)]">
                      <button
                        onClick={() => {
                          applyPreset(p);
                          close();
                        }}
                        className="flex-1 truncate text-left text-[12px] text-[var(--text-soft)]"
                        title={`Apply “${p.name}”`}
                      >
                        {p.name}
                      </button>
                      <button
                        onClick={() => deletePreset(p.name)}
                        className="rounded p-1 text-[var(--text-3)] hover:bg-[var(--danger-bg)] hover:text-[var(--danger-text)]"
                        title={`Delete “${p.name}”`}
                      >
                        <X size={11} />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => {
                      const name = window.prompt("Name this view preset:", "My view");
                      if (name && name.trim()) {
                        savePreset(name.trim());
                        close();
                      }
                    }}
                    className="mt-1 flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[12px] text-[var(--text-soft)] hover:bg-[var(--surface-2)]"
                  >
                    <Plus size={13} className="text-[var(--mint-text)]" /> Save current view
                  </button>
                </MenuGroup>
              </>
            )}
          </Dropdown>
          <button
            onClick={() => setSelectMode((v) => !v)}
            aria-pressed={selectMode}
            title="Select multiple items"
            className={`flex items-center gap-1 rounded-md border border-[var(--border)] px-2.5 py-1.5 font-mono text-[11px] ${
              selectMode ? "bg-[var(--surface-2)] text-[var(--text)]" : "text-[var(--text-3)]"
            }`}
          >
            <CheckSquare size={13} /> select
          </button>
          <Dropdown
            title="Advanced filters"
            trigger={
              <>
                <SlidersHorizontal size={13} /> filters
                {activeFilterCount > 0 && (
                  <span className="ml-0.5 rounded-full bg-[var(--violet-bg)] px-1.5 text-[10px] text-[var(--violet-text)]">
                    {activeFilterCount}
                  </span>
                )}
              </>
            }
          >
            {(close) => (
              <div className="flex flex-col gap-3 text-[12px]">
                <label className="flex items-center gap-2 text-[var(--text-2)]">
                  Language
                  <select
                    value={ui.langFilter}
                    onChange={(e) => updateUI({ langFilter: e.target.value })}
                    className="rounded border border-[var(--border)] bg-[var(--surface-input)] px-2 py-1 font-mono text-[11px] text-[var(--text-soft)] outline-none"
                  >
                    <option value="">any</option>
                    {allLanguages.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-2 text-[var(--text-2)]">
                  <input
                    type="checkbox"
                    checked={ui.hasNotesOnly}
                    onChange={(e) => updateUI({ hasNotesOnly: e.target.checked })}
                    className="accent-[var(--mint-text)]"
                  />
                  has notes
                </label>
                {allTags.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="flex items-center gap-1 text-[var(--text-3)]">
                      <TagIcon size={11} /> tags
                    </span>
                    {allTags.map((t) => {
                      const on = ui.tagFilter.includes(t);
                      return (
                        <button
                          key={t}
                          onClick={() =>
                            updateUI({
                              tagFilter: on ? ui.tagFilter.filter((x) => x !== t) : [...ui.tagFilter, t]
                            })
                          }
                          className={`rounded-full border px-2 py-0.5 font-mono text-[11px] ${
                            on
                              ? "border-[var(--violet-border)] bg-[var(--violet-bg)] text-[var(--violet-text)]"
                              : "border-[var(--border)] text-[var(--text-3)]"
                          }`}
                        >
                          {t}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </Dropdown>
          {activeFilterCount > 0 && (
            <button
              onClick={() => updateUI({ langFilter: "", tagFilter: [], hasNotesOnly: false })}
              className="flex items-center gap-1 rounded-md border border-[var(--border)] px-2.5 py-1.5 text-[11px] text-[var(--text-3)] hover:text-[var(--danger-text-hover)]"
            >
              <X size={11} /> clear
            </button>
          )}
        </div>

        {ui.view === "graph" && graphItems.length === 0 ? (
          <div className="mt-6 rounded-lg border border-dashed border-[var(--border)] py-10 text-center text-[13px] text-[var(--text-3)]">
            Nothing tracked yet — add a developer or a repo above to start the graph.
          </div>
        ) : ui.view !== "graph" && ui.view !== "insights" && items.length === 0 ? (
          <div className="mt-6 rounded-lg border border-dashed border-[var(--border)] py-10 text-center text-[13px] text-[var(--text-3)]">
            Nothing matches your filters — try clearing some filters!
          </div>
        ) : ui.view === "insights" ? (
          <Insights items={items} digest={buildDigest(data)} />
        ) : ui.view === "graph" ? (
          <GraphView items={graphItems} langFilter={ui.langFilter} onLangFilterChange={(lang) => updateUI({ langFilter: lang })} setToast={setToast} onExportSubgraph={exportSubgraph} onAddDev={addDev} />
        ) : useVirtual ? (
          <VirtualList items={items} renderItem={renderItem} estimate={compact ? 150 : 210} gap={gap} />
        ) : ui.group !== "none" ? (
          ui.view === "grid" ? (
            <div className="mt-6 space-y-6">
              {buildSections(items, ui.group).map((sec) => (
                <section key={sec.key}>
                  <div className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--bg)] py-1.5 font-mono text-[11px] uppercase tracking-wider text-[var(--text-3)]">
                    {sec.label} <span className="text-[var(--text-4)]">· {sec.items.length}</span>
                  </div>
                  <div className={`mt-3 ${vGridClass}`}>
                    {sec.items.map((it) => (
                      <div key={it.id}>{renderItem(it)}</div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="list-scroll mt-6 max-h-[72vh] space-y-6 overflow-y-auto pr-1">
              {buildSections(items, ui.group).map((sec) => (
                <section key={sec.key}>
                  <div className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--bg)] py-1.5 font-mono text-[11px] uppercase tracking-wider text-[var(--text-3)]">
                    {sec.label} <span className="text-[var(--text-4)]">· {sec.items.length}</span>
                  </div>
                  <div className="mt-3 space-y-4">
                    {sec.items.map((it) => (
                      <React.Fragment key={it.id}>{renderItem(it)}</React.Fragment>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )
        ) : ui.view === "grid" ? (
          <div className={`mt-6 ${vGridClass}`}>
            {items.map((it) => (
              <div key={it.id}>{renderItem(it)}</div>
            ))}
          </div>
        ) : (
          <div className="list-scroll mt-6 max-h-[72vh] overflow-y-auto pr-1 space-y-4">
            {items.map((it) => (
              <div key={it.id}>{renderItem(it)}</div>
            ))}
          </div>
        )}

        <p className="mt-8 text-center text-[11px] text-[var(--text-4)]">
          Data is stored in this browser's local storage — nothing leaves your device except GitHub API lookups.
        </p>
      </div>
      
      {/* Delete Modal */}
      {deleteModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div>
                <h2 className="font-display text-lg font-semibold text-[var(--text)]">
                  Delete {deleteModal.type === "dev" ? (data.devs[deleteModal.username]?.name || "@"+deleteModal.username) : deleteModal.fullName}
                </h2>
              </div>
              <button onClick={() => setDeleteModal(null)} className="rounded p-1 text-[var(--text-3)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]">
                <X size={18} />
              </button>
            </div>
            
            <div className="mt-4 space-y-4">
              <p className="text-sm text-[var(--text-2)]">
                This will remove the {deleteModal.type === "dev" ? "developer" : "repository"}. You can also choose to delete linked items.
              </p>
              
              {deleteModal.type === "dev" && (data.devs[deleteModal.username]?.linkedRepos?.length || 0) > 0 && (
                <div>
                  <div className="mb-2 font-mono text-xs uppercase tracking-wider text-[var(--text-3)]">
                    Also delete linked repositories:
                  </div>
                  <div className="max-h-40 space-y-1 overflow-y-auto">
                    {data.devs[deleteModal.username].linkedRepos.map((repoName) => (
                      <label key={repoName} className="flex items-center gap-2 rounded px-2 py-1 text-sm text-[var(--text)] hover:bg-[var(--surface-2)]">
                        <input
                          type="checkbox"
                          checked={deleteModal.linkedItemsToDelete.includes(repoName)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setDeleteModal({ ...deleteModal, linkedItemsToDelete: [...deleteModal.linkedItemsToDelete, repoName] });
                            } else {
                              setDeleteModal({ ...deleteModal, linkedItemsToDelete: deleteModal.linkedItemsToDelete.filter(r => r !== repoName) });
                            }
                          }}
                          className="accent-[var(--mint-text)]"
                        />
                        <span>{repoName}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              
              {deleteModal.type === "repo" && (data.repos[deleteModal.fullName]?.linkedDevs?.length || 0) > 0 && (
                <div>
                  <div className="mb-2 font-mono text-xs uppercase tracking-wider text-[var(--text-3)]">
                    Also delete linked developers:
                  </div>
                  <div className="max-h-40 space-y-1 overflow-y-auto">
                    {data.repos[deleteModal.fullName].linkedDevs.map((username) => (
                      <label key={username} className="flex items-center gap-2 rounded px-2 py-1 text-sm text-[var(--text)] hover:bg-[var(--surface-2)]">
                        <input
                          type="checkbox"
                          checked={deleteModal.linkedItemsToDelete.includes(username)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setDeleteModal({ ...deleteModal, linkedItemsToDelete: [...deleteModal.linkedItemsToDelete, username] });
                            } else {
                              setDeleteModal({ ...deleteModal, linkedItemsToDelete: deleteModal.linkedItemsToDelete.filter(u => u !== username) });
                            }
                          }}
                          className="accent-[var(--mint-text)]"
                        />
                        <span>{data.devs[username]?.name || "@"+username}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="mt-4 flex justify-end gap-2">
                <button
                  onClick={() => setDeleteModal(null)}
                  className="rounded border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-3)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="rounded border border-[var(--danger-border)] bg-[var(--danger-bg)] px-4 py-2 text-sm font-medium text-[var(--danger-text)] hover:opacity-90"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectMode && selected.size > 0 && (
        <div className="fixed bottom-5 left-1/2 z-20 flex max-w-[92vw] -translate-x-1/2 flex-wrap items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 shadow-xl">
          <span className="font-mono text-[11px] text-[var(--text-2)]">{selected.size} selected</span>
          <button
            onClick={() => setSelected(new Set(items.map((i) => i.id)))}
            className="rounded px-2 py-1 text-[11px] text-[var(--text-soft)] hover:bg-[var(--surface-2)]"
          >
            Select all
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="rounded px-2 py-1 text-[11px] text-[var(--text-soft)] hover:bg-[var(--surface-2)]"
          >
            Clear
          </button>
          <span className="h-4 w-px bg-[var(--border)]" />
          <input
            value={bulkTag}
            onChange={(e) => setBulkTag(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && tagSelected()}
            placeholder="+ tag selected"
            className="w-28 rounded border border-[var(--border)] bg-[var(--surface-input)] px-2 py-1 font-mono text-[11px] text-[var(--text)] outline-none placeholder-[var(--placeholder)]"
          />
          <button
            onClick={tagSelected}
            className="rounded px-2 py-1 text-[11px] text-[var(--violet-text)] hover:bg-[var(--violet-bg)]"
          >
            Tag
          </button>
          <button
            onClick={() => {
              const ids = [...selected];
              const devIds = ids.filter((id) => id.startsWith("dev:")).map((id) => id.slice(4));
              const repoIds = ids.filter((id) => id.startsWith("repo:")).map((id) => id.slice(5));
              if (devIds.length === 0 || repoIds.length === 0) {
                setToast("Select at least one dev and one repo to link");
                setTimeout(() => setToast(""), 2500);
                return;
              }
              let next = data;
              for (const u of devIds) {
                const dev = next.devs[u];
                if (!dev) continue;
                const merged = new Set([...(dev.linkedRepos || []), ...repoIds]);
                next = { ...next, devs: { ...next.devs, [u]: { ...dev, linkedRepos: [...merged] } } };
              }
              for (const r of repoIds) {
                const repo = next.repos[r];
                if (!repo) continue;
                const merged = new Set([...(repo.linkedDevs || []), ...devIds]);
                next = { ...next, repos: { ...next.repos, [r]: { ...repo, linkedDevs: [...merged] } } };
              }
              persist(next);
              setToast(`Linked ${devIds.length} dev × ${repoIds.length} repo`);
              setTimeout(() => setToast(""), 2500);
            }}
            className="rounded px-2 py-1 text-[11px] text-[var(--violet-text)] hover:bg-[var(--violet-bg)]"
          >
            Link
          </button>
          <button
            onClick={exportSelected}
            className="rounded px-2 py-1 text-[11px] text-[var(--mint-text)] hover:bg-[var(--mint-bg)]"
          >
            Export
          </button>
          <button
            onClick={deleteSelected}
            className="rounded px-2 py-1 text-[11px] text-[var(--danger-text-hover)] hover:bg-[var(--danger-bg)]"
          >
            Delete
          </button>
        </div>
      )}

      {browsing && (
        <RepoBrowser
          username={browsing}
          existing={data.repos}
          onAdd={(repos) => addReposBulk(repos, browsing)}
          onClose={() => setBrowsing(null)}
          setToast={setToast}
        />
      )}

      {toast && (
        <div className="fixed left-1/2 top-5 z-40 flex -translate-x-1/2 items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-[12px] text-[var(--text)] shadow-xl">
          <Check size={13} className="text-[var(--mint-text)]" /> {toast}
        </div>
      )}
    </div>
  );
}

