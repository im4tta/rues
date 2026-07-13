export interface StickyNote {
  id: string;
  content: string;
  color: string;
  createdAt: string;
}

export interface Developer {
  username: string;
  name?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  followers?: number | null;
  location?: string | null;
  tags: string[];
  notes: string;
  linkedRepos: string[];
  lastSynced?: string;
  addedAt: string;
  isMe?: boolean;
  isContributor?: boolean;
  contributions?: number;
  stickyNotes?: StickyNote[];
}

export interface Repo {
  fullName: string;
  description?: string | null;
  stars?: number | null;
  language?: string | null;
  htmlUrl: string;
  lastCommit?: string | null;
  tags: string[];
  notes: string;
  linkedDevs: string[];
  lastSynced?: string;
  addedAt: string;
  stickyNotes?: StickyNote[];
}

export interface DirectoryData {
  devs: Record<string, Developer>;
  repos: Record<string, Repo>;
}

export const emptyDirectory = (): DirectoryData => ({ devs: {}, repos: {} });

export type Item = { kind: "dev"; id: string; data: Developer } | { kind: "repo"; id: string; data: Repo };
export type SortKey = "name" | "stars" | "lastSynced" | "addedAt";
export type GroupKey = "none" | "tag" | "linked";
export type Density = "comfortable" | "compact";
export type UIPrefs = {
  filter: "all" | "devs" | "repos";
  view: "list" | "grid" | "graph" | "insights";
  sort: SortKey;
  group: GroupKey;
  density: Density;
  langFilter: string;
  tagFilter: string[];
  hasNotesOnly: boolean;
};

export type ViewPreset = {
  name: string;
  filter: UIPrefs["filter"];
  view: UIPrefs["view"];
  sort: SortKey;
  group: GroupKey;
  density: Density;
  langFilter: string;
  tagFilter: string[];
  hasNotesOnly: boolean;
};
