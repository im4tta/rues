import type { UIPrefs } from "@/lib/types";

export const VIRTUALIZE_THRESHOLD = 40;

export const DEFAULT_UI: UIPrefs = {
  filter: "all",
  view: "list",
  sort: "lastSynced",
  group: "none",
  density: "comfortable",
  langFilter: "",
  tagFilter: [],
  hasNotesOnly: false,
};
