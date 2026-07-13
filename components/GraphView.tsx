"use client";

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import {
  Clock,
  Download,
  ExternalLink,
  FolderGit2,
  GitCommit,
  Loader2,
  Plus,
  Search,
  Shuffle,
  Star,
  User,
  Users,
  X
} from "lucide-react";
import type { Developer, Repo, Item } from "@/lib/types";
import { timeAgo, formatDateTime, syncLabel } from "@/lib/format";
import { languageColor } from "@/lib/colors";
import { computeClusters, clusterColor } from "@/lib/analytics";
import { renderBasicMarkdownLines } from "@/lib/markdown";
import { useClickOutside } from "@/hooks/useClickOutside";
import { Chip } from "@/components/ui/Chip";
import { StickyNoteCard } from "@/components/ui/StickyNoteCard";

export const GraphView = React.memo(function GraphView({
  items: _items, langFilter, onLangFilterChange, setToast, onExportSubgraph, onAddDev
}: {
  items: Item[];
  langFilter: string;
  onLangFilterChange: (lang: string) => void;
  setToast: (s: string) => void;
  onExportSubgraph?: (ids: string[]) => void;
  onAddDev?: (username: string) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [showLabels, setShowLabels] = useState(true);
  const [sizeBy, setSizeBy] = useState<"impact" | "equal">("impact");
  const [colorBy, setColorBy] = useState<"kind" | "language" | "cluster">("kind");
  const [connectedOnly, setConnectedOnly] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [searchQuery, setSearchQuery] = useState("");
  const [focusMode, setFocusMode] = useState(false);
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);
  const [detailSide, setDetailSide] = useState<"left" | "right">("left");
  const [showExportPopup, setShowExportPopup] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [cssFullscreen, setCssFullscreen] = useState(false);
  const exportAreaRef = useRef<HTMLDivElement>(null);
  const selectedDevRef = useRef<any>(null);
  const [pinVersion, setPinVersion] = useState(0);
  const pinnedRef = useRef<Set<string>>(new Set());
  const simRef = useRef<d3.Simulation<any, any> | null>(null);
  const adjRef = useRef<Map<string, Set<string>>>(new Map());
  const nodeSelectionRef = useRef<d3.Selection<SVGGElement, any, SVGGElement, unknown> | null>(null);
  const linkSelectionRef = useRef<any>(null);
  const [graphSelectMode, setGraphSelectMode] = useState(false);
  const graphSelectRef = useRef(false);
  graphSelectRef.current = graphSelectMode;
  const [graphSelected, setGraphSelected] = useState<Set<string>>(new Set());
  const selectionRectRef = useRef<SVGRectElement | null>(null);
  const [hover, setHover] = useState<{ item: Item | null; x: number; y: number } | null>(null);
  const [activity, setActivity] = useState<{ loading: boolean; error?: string; events: any[] }>({ loading: false, events: [] });

  // Contributors overlay: fetch repo contributors and show them as connected nodes.
  type Contributor = { login: string; avatar_url: string; contributions: number; html_url: string };
  const [showContributors, setShowContributors] = useState(false);
  const [contributors, setContributors] = useState<Record<string, Contributor[]>>({});
  const [contribLoading, setContribLoading] = useState(false);

  const isContribId = (id: string) => id.startsWith("contrib:");

  // Augment the item list with contributor pseudo-devs when the overlay is on.
  const items = useMemo<Item[]>(() => {
    if (!showContributors) return _items;
    const extra: Item[] = [];
    for (const it of _items) {
      if (it.kind !== "repo") continue;
      const cs = contributors[it.data.fullName];
      if (!cs) continue;
      for (const c of cs) {
        extra.push({
          kind: "dev",
          id: `contrib:${it.data.fullName}:${c.login}`,
          data: {
            username: c.login,
            name: c.login,
            avatar_url: c.avatar_url,
            bio: `Contributor · ${c.contributions} commits`,
            tags: [],
            notes: "",
            linkedRepos: [it.data.fullName],
            linkedDevs: [],
            addedAt: "",
            isContributor: true,
            contributions: c.contributions,
          } as any,
        });
      }
    }
    return [..._items, ...extra];
  }, [_items, showContributors, contributors]);

  // Fetch contributors for repos that haven't been loaded yet.
  const repoNamesKey = useMemo(
    () => _items.filter((i) => i.kind === "repo").map((i) => (i.data as any).fullName).join("|"),
    [_items]
  );
  useEffect(() => {
    if (!showContributors) return;
    const names = repoNamesKey ? repoNamesKey.split("|") : [];
    const missing = names.filter((n) => n && !contributors[n]);
    if (missing.length === 0) return;
    let cancelled = false;
    setContribLoading(true);
    (async () => {
      const results: Array<[string, Contributor[]]> = await Promise.all(
        missing.map(async (n) => {
          const [o, r] = n.split("/");
          try {
            const res = await fetch(`/api/github/repo/${o}/${r}/contributors`);
            if (!res.ok) return [n, [] as Contributor[]];
            const j = await res.json();
            return [n, (j.contributors || []) as Contributor[]];
          } catch {
            return [n, [] as Contributor[]];
          }
        })
      );
      if (cancelled) return;
      setContributors((prev) => {
        const next = { ...prev };
        for (const [n, cs] of results) next[n] = cs;
        return next;
      });
      setContribLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showContributors, repoNamesKey]);

  useClickOutside(detailRef, () => setSelected(null), !!selected);

  // Prevent export button clicks from closing the detail panel
  useEffect(() => {
    const el = exportAreaRef.current;
    if (!el) return;
    const handler = (e: MouseEvent) => e.stopPropagation();
    el.addEventListener("mousedown", handler);
    return () => el.removeEventListener("mousedown", handler);
  }, []);

  // Fullscreen via native Fullscreen API, with CSS fallback for mobile
  useEffect(() => {
    const onFsChange = () => {
      if (!document.fullscreenElement) {
        setFullscreen(false);
        document.body.style.overflow = "";
        document.documentElement.style.overflow = "";
      }
    };
    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("webkitfullscreenchange", onFsChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFsChange);
      document.removeEventListener("webkitfullscreenchange", onFsChange);
    };
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (fullscreen) {
      if (cssFullscreen) {
        document.body.style.overflow = "";
        document.documentElement.style.overflow = "";
        setCssFullscreen(false);
        setFullscreen(false);
      } else {
        document.exitFullscreen();
      }
    } else {
      const el = containerRef.current;
      if (!el) return;
      try {
        const promise = el.requestFullscreen();
        if (promise) promise.catch(() => {
          document.body.style.overflow = "hidden";
          document.documentElement.style.overflow = "hidden";
          setCssFullscreen(true);
          setFullscreen(true);
        });
      } catch {
        document.body.style.overflow = "hidden";
        document.documentElement.style.overflow = "hidden";
        setCssFullscreen(true);
        setFullscreen(true);
      }
    }
  }, [fullscreen, cssFullscreen]);

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        });
      }
    };
    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  const panToNode = useCallback((nodeId: string) => {
    const svg = svgRef.current;
    if (!svg) return;
    const nd = simRef.current?.nodes().find((n: any) => n.id === nodeId) as any;
    if (!nd || nd.x == null) return;
    const w = dimensions.width, h = dimensions.height;
    const transform = d3.zoomIdentity.translate(w / 2 - nd.x * 1, h / 2 - nd.y * 1).scale(1);
    d3.select(svg).transition().duration(400).call(zoomRef.current!.transform as any, transform);
  }, [dimensions]);

  // Build graph data
  const { nodes, edges, degree, languages } = useMemo(() => {
    const present = new Set(items.map((i) => i.id));
    const raw = items.map((it) => {
      const metric = it.kind === "dev" ? it.data.followers ?? 0 : it.data.stars ?? 0;
      const r = sizeBy === "equal" ? 9 : Math.max(7, Math.min(26, 7 + Math.sqrt(Math.max(0, metric)) * 0.9));
      const lang = it.kind === "repo" ? it.data.language : undefined;
      return {
        id: it.id,
        label: it.kind === "dev" ? it.data.username : it.data.fullName,
        type: it.kind,
        r,
        language: lang,
      };
    });

    const clusterMap = computeClusters(items);

    let es: { source: string; target: string; kind: string }[] = [];
    const adj = new Map<string, Set<string>>();
    const degree = new Map<string, number>();
    const langSet = new Set<string>();

    for (const it of items) {
      if (it.kind === "repo" && it.data.language) langSet.add(it.data.language);
      const links = it.kind === "dev" ? it.data.linkedRepos : it.data.linkedDevs;
      for (const l of links || []) {
        const other = it.kind === "dev" ? `repo:${l}` : `dev:${l}`;
        if (present.has(other)) {
          es.push({ source: it.id, target: other, kind: "link" });
          if (!adj.has(it.id)) adj.set(it.id, new Set());
          if (!adj.has(other)) adj.set(other, new Set());
          adj.get(it.id)!.add(other);
          adj.get(other)!.add(it.id);
          degree.set(it.id, (degree.get(it.id) || 0) + 1);
          degree.set(other, (degree.get(other) || 0) + 1);
        }
      }
    }

    // Apply filters: build active ID set from cumulative filters
    let activeIds = new Set(raw.map((n) => n.id));

    // langFilter: remove repos that don't match the language
    if (langFilter) {
      const keep = new Set(raw.filter((n) => n.type !== "repo" || n.language === langFilter).map((n) => n.id));
      activeIds = new Set([...activeIds].filter((id) => keep.has(id)));
    }

    // searchQuery filter
    const sq = searchQuery.toLowerCase().trim();
    if (sq) {
      const matched = new Set(raw.filter((n) => n.label.toLowerCase().includes(sq)).map((n) => n.id));
      activeIds = new Set([...activeIds].filter((id) => matched.has(id)));
    }

    // connectedOnly: keep only nodes that have at least one edge
    if (connectedOnly && es.length > 0) {
      const connected = new Set<string>();
      for (const e of es) {
        if (activeIds.has(e.source) && activeIds.has(e.target)) {
          connected.add(e.source);
          connected.add(e.target);
        }
      }
      activeIds = new Set([...activeIds].filter((id) => connected.has(id)));
    }

    const ns = raw.filter((n) => activeIds.has(n.id)).map((n) => ({ ...n, cluster: clusterMap.get(n.id) ?? 0 }));
    const filteredEdges = es.filter((e) => activeIds.has(e.source) && activeIds.has(e.target));

    adjRef.current = adj;
    return {
      nodes: ns,
      edges: filteredEdges,
      degree,
      languages: Array.from(langSet).sort()
    };
  }, [items, sizeBy, connectedOnly, langFilter, searchQuery]);

  // D3 force simulation
  useLayoutEffect(() => {
    if (!svgRef.current || !nodes.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const g = svg.append("g");

    const selectionRect = svg.append("rect")
      .attr("fill", "rgba(167,139,250,0.08)")
      .attr("stroke", "var(--violet-text)")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "4 2")
      .attr("rx", 4)
      .attr("display", "none");
    selectionRectRef.current = selectionRect.node();

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.15, 4])
      .on("zoom", (event) => {
        if (graphSelectRef.current) return;
        g.attr("transform", event.transform);
      });
    svg.call(zoom);
    zoomRef.current = zoom;

    const radiusFn = (d: any) => {
      if (isContribId(d.id)) return 4.5;
      if (sizeBy === "equal") return 9;
      const base = 8;
      return base + Math.min(degree.get(d.id) || 0, 10) * 1.4;
    };

    const colorFn = (d: any) => {
      if (isContribId(d.id)) return "var(--amber-text)";
      if (colorBy === "cluster") return clusterColor(d.cluster ?? 0);
      if (colorBy === "language") {
        if (d.type === "dev") return "var(--violet-text)";
        if (d.language) return languageColor(d.language);
        return "var(--mint-text)";
      }
      if (d.type === "dev") return "var(--violet-text)";
      if (d.language) return languageColor(d.language);
      return "var(--mint-text)";
    };

    const sim = d3.forceSimulation(nodes as any)
      .force("link", d3.forceLink(edges).id((d: any) => d.id).distance(78).strength(0.55))
      .force("charge", d3.forceManyBody().strength(-230))
      .force("center", d3.forceCenter(dimensions.width / 2, dimensions.height / 2))
      .force("collide", d3.forceCollide((d: any) => radiusFn(d) + 28));
    simRef.current = sim;

    const getLinkedNodes = (nodeId: string): string[] => {
      const linked: string[] = [];
      adjRef.current.forEach((targets, source) => {
        if (source === nodeId) targets.forEach(t => linked.push(t));
        if (targets.has(nodeId)) linked.push(source);
      });
      return [...new Set(linked)];
    };

    const link = g.append("g").selectAll("line")
      .data(edges)
      .join("line")
      .attr("class", "graph-edge")
      .attr("data-src", (d: any) => (typeof d.source === "object" ? d.source.id : d.source))
      .attr("data-dst", (d: any) => (typeof d.target === "object" ? d.target.id : d.target))
      .attr("stroke", "var(--border-subtle)")
      .attr("stroke-width", 1)
      .attr("opacity", 0.55);
    linkSelectionRef.current = link;
    link.append("title").text((d: any) => {
      const s = typeof d.source === "object" ? d.source.label || d.source.id : d.source;
      const t = typeof d.target === "object" ? d.target.label || d.target.id : d.target;
      return `${s} ↔ ${t}`;
    });

    const node = g.append("g").selectAll("g")
      .data(nodes, (d: any) => d.id)
      .join("g")
      .attr("class", (d: any) => "graph-node node-" + d.type)
      .attr("data-id", (d: any) => d.id)
      .call((d3.drag<SVGGElement, any>()
        .on("start", (event, d: any) => {
          if (!event.active) sim.alphaTarget(0.25).restart();
          const affectedIds = [d.id, ...getLinkedNodes(d.id)];
          const initial: Record<string, { x: number; y: number }> = {};
          nodes.forEach((n: any) => {
            if (affectedIds.includes(n.id)) {
              initial[n.id] = { x: n.x, y: n.y };
              n.fx = n.x;
              n.fy = n.y;
            }
          });
          (d as any)._initialDrag = { positions: initial, affectedIds };
        })
        .on("drag", (event, d: any) => {
          const initialData = (d as any)._initialDrag;
          if (!initialData) return;
          const dx = event.x - initialData.positions[d.id].x;
          const dy = event.y - initialData.positions[d.id].y;
          nodes.forEach((n: any) => {
            if (initialData.affectedIds.includes(n.id)) {
              n.fx = initialData.positions[n.id].x + dx;
              n.fy = initialData.positions[n.id].y + dy;
            }
          });
        })
        .on("end", (event, d: any) => {
          if (!event.active) sim.alphaTarget(0);
          const initialData = (d as any)._initialDrag;
          if (!initialData) return;
          nodes.forEach((n: any) => {
            if (initialData.affectedIds.includes(n.id)) {
              n.fx = null;
              n.fy = null;
            }
          });
          delete (d as any)._initialDrag;
        })
      ) as any)
        .on("click", (event, d: any) => {
          event.stopPropagation();
          if (graphSelectMode) {
            setGraphSelected((prev) => {
              const next = new Set(prev);
              if (next.has(d.id)) next.delete(d.id); else next.add(d.id);
              return next;
            });
            return;
          }
          setSelected(d.id);
          setFocusNodeId(d.id);
          panToNode(d.id);
          if (simRef.current) simRef.current.alpha(0.25).restart();
        })
        .on("dblclick", (event, d: any) => {
          event.stopPropagation();
          setSelected(d.id);
          setFocusNodeId(d.id);
          panToNode(d.id);
        })
      .on("mouseover", (event, d: any) => {
        const rect = containerRef.current?.getBoundingClientRect();
        const byId = new Map(items.map((i) => [i.id, i]));
        setHover({ item: byId.get(d.id) || null, x: event.clientX - (rect?.left ?? 0), y: event.clientY - (rect?.top ?? 0) });
      })
      .on("mousemove", (event) => {
        const rect = containerRef.current?.getBoundingClientRect();
        setHover((prev) => prev ? { ...prev, x: event.clientX - (rect?.left ?? 0), y: event.clientY - (rect?.top ?? 0) } : prev);
      })
      .on("mouseout", () => setHover(null));

    let selStart: { x: number; y: number } | null = null;
    svg.on("mousedown.selection", (event: MouseEvent) => {
      if (!graphSelectRef.current) return;
      const rect = svgRef.current!.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      selStart = { x, y };
      selectionRect.attr("display", "block").attr("x", x).attr("y", y).attr("width", 0).attr("height", 0);
    });
    svg.on("mousemove.selection", (event: MouseEvent) => {
      if (!selStart) return;
      const rect = svgRef.current!.getBoundingClientRect();
      const cx = event.clientX - rect.left;
      const cy = event.clientY - rect.top;
      const x = Math.min(selStart.x, cx);
      const y = Math.min(selStart.y, cy);
      selectionRect.attr("x", x).attr("y", y).attr("width", Math.abs(cx - selStart.x)).attr("height", Math.abs(cy - selStart.y));
    });
    svg.on("mouseup.selection", () => {
      if (!selStart) return;
      const sr = selectionRect.node();
      if (!sr) { selStart = null; return; }
      const rx = +sr.getAttribute("x")!;
      const ry = +sr.getAttribute("y")!;
      const rw = +sr.getAttribute("width")!;
      const rh = +sr.getAttribute("height")!;
      selectionRect.attr("display", "none");
      if (rw < 3 && rh < 3) {
        setGraphSelected(new Set());
        selStart = null;
        return;
      }
      const svgEl = svgRef.current!;
      const svgRect = svgEl.getBoundingClientRect();
      const transform = d3.zoomTransform(svgEl);
      const selectedIds: string[] = [];
      nodeSelectionRef.current?.selectAll("circle").each(function (d: any) {
        const cr = (this as SVGCircleElement).getBoundingClientRect();
        const nx = cr.left + cr.width / 2 - svgRect.left;
        const ny = cr.top + cr.height / 2 - svgRect.top;
        if (nx >= rx && nx <= rx + rw && ny >= ry && ny <= ry + rh) {
          selectedIds.push(d.id);
        }
      });
      setGraphSelected(new Set(selectedIds));
      selStart = null;
    });

    svg.on("click.clear", () => {
      if (!graphSelectRef.current) {
        setSelected(null);
        setFocusNodeId(null);
      }
    });

    node.append("circle")
      .attr("r", radiusFn)
      .attr("fill", colorFn)
      .attr("fill-opacity", 0.18)
      .attr("stroke", "none");

    node.append("text")
      .text((d: any) => d.label)
      .attr("y", (d: any) => radiusFn(d) + 14)
      .attr("text-anchor", "middle")
      .style("fill", "var(--text)")
      .style("font-family", "JetBrains Mono, monospace")
      .style("font-size", "10px")
      .style("pointer-events", "none")
      .style("paint-order", "stroke")
      .style("stroke", "var(--bg)")
      .style("stroke-width", "2.5px")
      .style("stroke-linecap", "round")
      .style("stroke-linejoin", "round")
      .style("display", showLabels ? "block" : "none");

    nodeSelectionRef.current = node as any;

    sim.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);
      node.attr("transform", (d: any) => "translate(" + d.x + "," + d.y + ")");
    });

    let fitted = false;
    sim.on("end", () => {
      if (fitted) return;
      fitted = true;
      const svgEl = svgRef.current;
      if (!svgEl) return;
      const bounds = (svgEl.querySelector("g") as SVGGElement)?.getBBox();
      if (!bounds || bounds.width === 0 || bounds.height === 0) return;
      const w = dimensions.width, h = dimensions.height;
      const pad = 40;
      const scale = Math.min((w - pad * 2) / bounds.width, (h - pad * 2) / bounds.height, 2.5);
      const tx = w / 2 - (bounds.x + bounds.width / 2) * scale;
      const ty = h / 2 - (bounds.y + bounds.height / 2) * scale;
      d3.select(svgEl).transition().duration(500).call(zoomRef.current!.transform as any, d3.zoomIdentity.translate(tx, ty).scale(scale));
    });

    return () => { sim.stop(); svg.on("mousedown.selection", null); svg.on("mousemove.selection", null); svg.on("mouseup.selection", null); svg.on("click.clear", null); };
  }, [nodes, edges, dimensions, sizeBy, showLabels]);

  // Smooth sizeBy transition (update radii + forceCollide without rebuild)
  useEffect(() => {
    if (!nodeSelectionRef.current) return;
    const radiusFn = (d: any) => {
      if (isContribId(d.id)) return 4.5;
      if (sizeBy === "equal") return 9;
      return 8 + Math.min(degree.get(d.id) || 0, 10) * 1.4;
    };
    nodeSelectionRef.current.selectAll("circle")
      .transition?.()
      .duration(300)
      .attr("r", radiusFn);
    nodeSelectionRef.current.selectAll("text")
      .attr("y", (d: any) => radiusFn(d) + 13);
    if (simRef.current) {
      simRef.current.force("collide", d3.forceCollide((d: any) => radiusFn(d) + 28));
      simRef.current.alpha(0.1).restart();
    }
  }, [sizeBy, degree]);

  // Visual state (selected, focus mode, labels, pins)
  useEffect(() => {
    if (!nodeSelectionRef.current) return;

    // The focused anchor is the explicit focus node, or the currently selected node.
    const focusAnchor = focusNodeId || selected;
    const focusing = !!focusAnchor;
    const focusAdj = new Set<string>();
    if (focusAnchor) {
      focusAdj.add(focusAnchor);
      adjRef.current.forEach((targets, source) => {
        if (source === focusAnchor) targets.forEach((t) => focusAdj.add(t));
        if (targets.has(focusAnchor)) focusAdj.add(source);
      });
    }

    nodeSelectionRef.current.selectAll("circle")
      .attr("fill-opacity", (d: any) => {
        if (selected === d.id) return 0.55;
        if (graphSelected.has(d.id)) return 0.45;
        if (focusing && !focusAdj.has(d.id)) return 0.04;
        return 0.18;
      })
      .attr("stroke", (d: any) => {
        if (selected === d.id) return d.type === "dev" ? "var(--violet-text)" : "var(--mint-text)";
        if (graphSelected.has(d.id)) return "var(--violet-text)";
        if (pinnedRef.current.has(d.id)) return "var(--amber-text)";
        return "none";
      })
      .attr("stroke-width", (d: any) => {
        if (selected === d.id) return 3;
        if (graphSelected.has(d.id)) return 2.5;
        if (pinnedRef.current.has(d.id)) return 1.5;
        return 0;
      })
      .classed("halo", (d: any) => selected === d.id);
    nodeSelectionRef.current.selectAll("text")
      .style("opacity", (d: any) => {
        if (graphSelected.has(d.id)) return "1";
        return focusing && !focusAdj.has(d.id) ? "0.15" : "1";
      })
      .style("display", showLabels ? "block" : "none");

    // Highlight the selected node's connecting line(s); dim everything else.
    if (linkSelectionRef.current) {
      linkSelectionRef.current
        .attr("stroke", (d: any) => {
          const s = typeof d.source === "object" ? d.source.id : d.source;
          const t = typeof d.target === "object" ? d.target.id : d.target;
          if (focusAnchor && (s === focusAnchor || t === focusAnchor)) {
            return focusAnchor.startsWith("dev:") ? "var(--violet-text)" : "var(--mint-text)";
          }
          return "var(--border-subtle)";
        })
        .attr("stroke-width", (d: any) => {
          const s = typeof d.source === "object" ? d.source.id : d.source;
          const t = typeof d.target === "object" ? d.target.id : d.target;
          return focusAnchor && (s === focusAnchor || t === focusAnchor) ? 2.5 : 1;
        })
        .attr("opacity", (d: any) => {
          const s = typeof d.source === "object" ? d.source.id : d.source;
          const t = typeof d.target === "object" ? d.target.id : d.target;
          if (focusAnchor && (s === focusAnchor || t === focusAnchor)) return 0.95;
          return focusing ? 0.1 : 0.55;
        });
    }
  }, [selected, showLabels, focusMode, focusNodeId, pinVersion, graphSelected]);

  // Export PNG
  const exportPng = useCallback((bgChoice: "dark" | "light" = "dark", focusItem?: any) => {
    const svgEl = svgRef.current;
    if (!svgEl) return;
    const rect = svgEl.getBoundingClientRect();
    if (!rect.width) return;
    const clone = svgEl.cloneNode(true) as SVGSVGElement;
    const bg = bgChoice === "light" ? "#f5f5f5" : "#0d1117";
    clone.setAttribute("width", String(rect.width));
    clone.setAttribute("height", String(rect.height));

    // Inject computed CSS variables so SVG text/stroke renders correctly as image
    const vars = bgChoice === "light"
      ? { "--text": "#1a1a2e", "--text-2": "#333333", "--text-3": "#555555", "--bg": bg, "--violet-text": "#6d28d9", "--mint-text": "#059669", "--border-subtle": "#dddddd" }
      : { "--text": "#ffffff", "--text-2": "#e1e4e8", "--text-3": "#8890a0", "--bg": bg, "--violet-text": "#a78bfa", "--mint-text": "#5fd9a4", "--border-subtle": "#30363d" };
    const styleEl = document.createElementNS("http://www.w3.org/2000/svg", "style");
    styleEl.textContent = `:root{${Object.entries(vars).map(([k, v]) => `${k}:${v};`).join("")}}`;
    clone.insertBefore(styleEl, clone.firstChild);

    const bgRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bgRect.setAttribute("width", "100%");
    bgRect.setAttribute("height", "100%");
    bgRect.setAttribute("fill", bg);
    clone.insertBefore(bgRect, clone.firstChild);

    // When focusing a node, isolate its local subgraph and re-fit the view.
    const idConnected = new Set<string>();
    if (focusItem) {
      idConnected.add(focusItem.id);
      if (focusItem.kind === "dev") (focusItem.data.linkedRepos || []).forEach((r: string) => idConnected.add("repo:" + r));
      else (focusItem.data.linkedDevs || []).forEach((u: string) => idConnected.add("dev:" + u));

      const groups = clone.querySelectorAll("g.graph-node");
      groups.forEach((g) => {
        const id = g.getAttribute("data-id");
        if (id && !idConnected.has(id)) {
          g.setAttribute("display", "none");
          g.setAttribute("pointer-events", "none");
        }
      });
      const lines = clone.querySelectorAll("line.graph-edge");
      lines.forEach((e) => {
        const s = e.getAttribute("data-src");
        const t = e.getAttribute("data-dst");
        if (s && t && s !== focusItem.id && t !== focusItem.id) {
          e.setAttribute("display", "none");
          e.setAttribute("pointer-events", "none");
        }
      });

      // Re-fit the SVG group to the focused subgraph's bounding box.
      const all = (simRef.current?.nodes() as any[]) || [];
      const sub = all.filter((n) => idConnected.has(n.id) && n.x != null);
      if (sub.length) {
        const xs = sub.map((n) => n.x as number);
        const ys = sub.map((n) => n.y as number);
        const minX = Math.min(...xs), maxX = Math.max(...xs);
        const minY = Math.min(...ys), maxY = Math.max(...ys);
        const bw = Math.max(maxX - minX, 1), bh = Math.max(maxY - minY, 1);
        const p = 70;
        const scale = Math.min((rect.width - p * 2) / bw, (rect.height - p * 2) / bh, 2.2) || 1;
        const tx = rect.width / 2 - ((minX + maxX) / 2) * scale;
        const ty = rect.height / 2 - ((minY + maxY) / 2) * scale;
        const topG = clone.querySelector("g");
        if (topG) topG.setAttribute("transform", `translate(${tx},${ty}) scale(${scale})`);
      }
    }

    const xml = new XMLSerializer().serializeToString(clone);
    const svg64 = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(xml)));
    const img = new Image();
    img.onload = () => {
      const dpr = Math.max(window.devicePixelRatio || 1, 2);
      const canvas = document.createElement("canvas");
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      const ctx = canvas.getContext("2d")!;
      ctx.scale(dpr, dpr);
      ctx.textBaseline = "alphabetic";
      ctx.textAlign = "left";

      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, rect.width, rect.height);
      ctx.drawImage(img, 0, 0, rect.width, rect.height);

      const pad = 16;
      const textColor = vars["--text"];
      const subColor = vars["--text-3"];
      const violet = vars["--violet-text"];
      const mint = vars["--mint-text"];
      const rr = (x: number, y: number, w: number, h: number, r: number) => {
        ctx.beginPath();
        if (typeof ctx.roundRect === "function") ctx.roundRect(x, y, w, h, r);
        else ctx.rect(x, y, w, h);
      };

      const devCount = nodes.filter((n) => n.type === "dev").length;
      const repoCount = nodes.length - devCount;
      const langList = Array.from(new Set(nodes.filter((n) => n.language).map((n) => n.language as string))).sort();

      const panelW = Math.min(320, Math.max(220, rect.width * 0.46));
      const contentMax = panelW - 28;

      const renderWrap = (text: string, maxW: number, color: string, lineH: number, lx: number, lyRef: { v: number }) => {
        ctx.fillStyle = color;
        const words = text.split(" ");
        let line = "";
        for (const w of words) {
          const test = line ? line + " " + w : w;
          if (ctx.measureText(test).width > maxW) {
            ctx.fillText(line, lx, lyRef.v); lyRef.v += lineH;
            line = w;
          } else { line = test; }
        }
        if (line) { ctx.fillText(line, lx, lyRef.v); lyRef.v += lineH; }
      };

      if (focusItem) {
        // --- Focused node details legend ---
        const d = focusItem.data;
        const isDev = focusItem.kind === "dev";
        const accent = isDev ? violet : mint;
        const linkedIds = isDev
          ? (d.linkedRepos || []).map((r: string) => "repo:" + r)
          : (d.linkedDevs || []).map((u: string) => "dev:" + u);
        const linkedLabels = nodes.filter((n: any) => linkedIds.includes(n.id)).map((n: any) => n.label);
        const tags = (d.tags || []).slice(0, 8);
        const tagW = (t: string) => Math.min(ctx.measureText(t).width + 16, contentMax);

        ctx.font = "500 10px 'JetBrains Mono', monospace";
        const wrapCount = (text: string, maxW: number) => {
          if (!text) return 0;
          const words = text.split(" ");
          let line = "", count = 1;
          for (const w of words) {
            const test = line ? line + " " + w : w;
            if (ctx.measureText(test).width > maxW) { count++; line = w; } else line = test;
          }
          return count;
        };

        const line1 = isDev ? `@${d.username}` : d.fullName;
        const statBits: string[] = isDev
          ? [`${d.followers ?? "—"} followers`, `${(d.linkedRepos || []).length} repos`, `${(d.tags || []).length} tags`]
          : [`⭐ ${d.stars ?? "—"}`, `${(d.linkedDevs || []).length} devs`, d.language ? d.language : ""].filter(Boolean);
        const line2 = statBits.join("  ·  ");
        const desc = isDev ? (d.bio || "") : (d.description || "");
        const bioLines = desc ? wrapCount(desc, contentMax) : 0;

        const stat1W = ctx.measureText(line1).width;
        const stat2W = ctx.measureText(line2).width;
        const statLines = (stat1W > contentMax ? wrapCount(line1, contentMax) : 1) + (stat2W > contentMax ? wrapCount(line2, contentMax) : 1);

        let tagRows = 0;
        if (tags.length) {
          ctx.font = "500 9px 'JetBrains Mono', monospace";
          let cx = pad; tagRows = 1;
          for (const t of tags) { const tw = tagW(t); if (cx + tw > pad - 8 + panelW - 12) { cx = pad; tagRows++; } cx += tw + 4; }
        }

        const linkedLines = linkedLabels.length ? wrapCount(linkedLabels.slice(0, 12).join(", "), contentMax) : 0;
        const hasLocation = isDev && !!d.location;

        let panelH = 24 + 22 + statLines * 15 + 6
          + (bioLines ? bioLines * 15 + 8 : 0)
          + (tags.length ? tagRows * 18 + 22 : 0)
          + (linkedLabels.length ? 14 + linkedLines * 14 + 8 : 0)
          + (hasLocation ? 18 : 0)
          + 12;
        panelH = Math.max(panelH, 130);

        ctx.save();
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        rr(pad - 8, pad - 8, panelW, panelH, 10);
        ctx.fill();
        ctx.beginPath(); rr(pad - 8, pad - 8, panelW, panelH, 10); ctx.clip();

        let lx = pad;
        const ly = { v: pad + 8 };

        ctx.font = "700 14px 'JetBrains Mono', monospace";
        ctx.fillStyle = accent;
        ctx.fillText((isDev ? (d.name || d.username) : d.fullName).slice(0, 32), lx, ly.v);
        ly.v += 22;

        ctx.font = "500 10px 'JetBrains Mono', monospace";
        ctx.fillStyle = subColor;
        renderWrap(line1, contentMax, subColor, 15, lx, ly);
        renderWrap(line2, contentMax, subColor, 15, lx, ly);
        ly.v += 6;

        if (hasLocation) {
          ctx.font = "500 10px 'JetBrains Mono', monospace";
          ctx.fillStyle = textColor;
          ctx.fillText(`📍 ${d.location}`, lx, ly.v);
          ly.v += 18;
        }
        if (desc && bioLines) {
          ctx.font = "500 10px 'JetBrains Mono', monospace";
          renderWrap(desc, contentMax, textColor, 15, lx, ly);
          ly.v += 8;
        }

        if (tags.length) {
          ctx.font = "500 9px 'JetBrains Mono', monospace";
          let cx = lx;
          for (const t of tags) {
            const tw = tagW(t);
            if (cx + tw > pad - 8 + panelW - 12) { cx = lx; ly.v += 18; }
            ctx.fillStyle = "rgba(167,139,250,0.15)";
            rr(cx, ly.v - 8, tw, 14, 4); ctx.fill();
            ctx.fillStyle = violet; ctx.fillText(t, cx + 8, ly.v); cx += tw + 4;
          }
          ly.v += 22;
        }

        if (linkedLabels.length) {
          ctx.font = "500 9px 'JetBrains Mono', monospace";
          ctx.fillStyle = subColor;
          ctx.fillText(isDev ? "Linked repositories:" : "Linked developers:", lx, ly.v);
          ly.v += 14;
          ctx.fillStyle = textColor;
          renderWrap(linkedLabels.slice(0, 12).join(", "), contentMax, textColor, 14, lx, ly);
        }
        ctx.restore();
      } else {
        // --- Legend (full graph) ---
        const langRows = Math.max(1, Math.ceil(Math.min(langList.length, 16) / 3));
        const panelH = 26 + 22 + 22 + 20 + langRows * 18 + 10;
        ctx.save();
        ctx.fillStyle = "rgba(0,0,0,0.45)";
        rr(pad - 8, pad - 8, panelW, panelH, 10);
        ctx.fill();
        ctx.beginPath();
        rr(pad - 8, pad - 8, panelW, panelH, 10);
        ctx.clip();
        let lx = pad, ly = pad + 8;
        ctx.font = "600 13px 'JetBrains Mono', monospace";
        ctx.fillStyle = textColor;
        ctx.fillText("Legend", lx, ly);
        ly += 22;
        const dot = (color: string, label: string) => {
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(lx + 6, ly - 4, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = textColor;
          ctx.fillText(label, lx + 18, ly);
          ly += 22;
        };
        dot(violet, `Developer (${devCount})`);
        dot(mint, `Repository (${repoCount})`);
        ctx.font = "500 11px 'JetBrains Mono', monospace";
        ctx.fillStyle = subColor;
        ctx.fillText("Languages:", lx, ly);
        ly += 16;
        let cxp = lx;
        for (const l of langList.slice(0, 16)) {
          const w = ctx.measureText(l).width + 18;
          if (cxp + w > pad - 8 + panelW - 8) { cxp = lx; ly += 16; }
          const lc = languageColor(l);
          ctx.fillStyle = lc.startsWith("var(") ? "#999999" : lc;
          ctx.fillRect(cxp, ly - 9, 9, 9);
          ctx.fillStyle = textColor;
          ctx.fillText(l, cxp + 13, ly);
          cxp += w + 6;
        }
        ctx.restore();
      }

      // --- Footer (bottom) ---
      const footer = "Rues (ឫស)";
      ctx.font = "500 12px 'JetBrains Mono', monospace";
      const fw = ctx.measureText(footer).width;
      const fpad = 12;
      const fy = rect.height - pad;
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      rr(rect.width - fw - fpad * 2, fy - 16, fw + fpad * 2, 26, 8);
      ctx.fill();
      ctx.fillStyle = textColor;
      ctx.fillText(footer, rect.width - fw - fpad, fy);

      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const date = new Date().toISOString().slice(0, 10);
        const name = focusItem
          ? (focusItem.kind === "dev" ? focusItem.data.username : focusItem.data.fullName.replace("/", "-"))
          : "graph";
        a.download = `rues-${name}-${date}.png`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      });
    };
    img.src = svg64;
  }, [nodes, edges]);

  if (nodes.length === 0) {
    return (
      <div className="mt-6 rounded-lg border border-dashed border-[var(--border)] py-10 text-center text-[13px] text-[var(--text-3)]">
        Nothing to graph yet — add developers or repos and link them together.
      </div>
    );
  }

  const devCount = nodes.filter((n) => n.type === "dev").length;
  const repoCount = nodes.length - devCount;
  const selectedItem = selected ? items.find((i) => i.id === selected) : undefined;
  if (selectedItem?.kind === "dev") selectedDevRef.current = selectedItem.data;
  else if (!selected) selectedDevRef.current = null;
  const isMobile = dimensions.width < 640;

  useEffect(() => {
    if (!selectedItem || selectedItem.kind !== "dev") {
      setActivity({ loading: false, events: [] });
      return;
    }
    const username = selectedItem.data.username;
    let cancelled = false;
    setActivity({ loading: true, events: [] });
    fetch(`/api/github/user/${encodeURIComponent(username)}/events`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setActivity({ loading: false, events: d.events || [], error: d.error });
      })
      .catch(() => {
        if (!cancelled) setActivity({ loading: false, error: "Failed to load activity", events: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [selectedItem]);

  const optBtn = (active: boolean) =>
    `rounded border px-1.5 py-1 font-mono text-[10px] leading-none ${
      active ? "border-[var(--mint-text)] bg-[var(--mint-bg)] text-[var(--mint-text)]" : "border-[var(--border)] text-[var(--text-3)] hover:text-[var(--text)]"
    }`;

  return (
    <div className={`${fullscreen && cssFullscreen ? "fixed inset-0 z-50 !bg-[var(--bg)]" : "mt-6"}`}>
      <div
        ref={containerRef}
        className={`relative bg-[var(--surface)] ${
          fullscreen
            ? "h-screen w-screen !bg-[var(--bg)]"
            : "h-[72vh] rounded-lg border border-[var(--border)]"
        }`}
      >
        <div className="absolute inset-0 overflow-hidden rounded-[inherit]">
        <svg
          ref={svgRef}
          className="h-full w-full cursor-grab touch-none select-none active:cursor-grabbing"
          width={dimensions.width}
          height={dimensions.height}
        />
        </div>

        {fullscreen && (
          <div className="absolute left-1/2 top-3 z-40 -translate-x-1/2">
            <button onClick={toggleFullscreen}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 font-mono text-[11px] text-[var(--text)] shadow-xl hover:bg-[var(--surface-2)]"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
              </svg>
              Exit fullscreen
            </button>
          </div>
        )}

        <div className="absolute right-2 top-2 z-30 flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--bg)] px-1.5 py-1">
          <Search size={10} className="text-[var(--text-3)]" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="filter nodes…"
            className="w-20 sm:w-28 bg-transparent text-[10px] text-[var(--text)] outline-none placeholder-[var(--placeholder)]"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="text-[var(--text-3)] hover:text-[var(--text)]"><X size={10} /></button>
          )}
        </div>

        <div className="absolute inset-x-3 bottom-3 z-20 flex flex-wrap items-end gap-x-2 gap-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[10px] text-[var(--text-2)]">
              <span className="h-2 w-2 rounded-full bg-[var(--violet-text)]" /> Dev
              <span className="text-[var(--text-3)]">{devCount}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[10px] text-[var(--text-2)]">
              <span className="h-2 w-2 rounded-full bg-[var(--mint-text)]" /> Repo
              <span className="text-[var(--text-3)]">{repoCount}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[10px] text-[var(--text-2)]">
              <span className="h-px w-3 bg-[var(--border-subtle)]" /> Link
              <span className="text-[var(--text-3)]">{edges.length}</span>
            </span>
            {languages.map((l) => {
              const active = langFilter === l;
              return (
                <button key={l} onClick={() => onLangFilterChange(active ? "" : l)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] ${
                    active
                      ? "border-[var(--mint-text)] bg-[var(--mint-bg)] text-[var(--mint-text)]"
                      : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-2)] hover:text-[var(--text)]"
                  }`}
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: languageColor(l) }} /> {l}
                </button>
              );
            })}
          </div>
          <div className="ml-auto flex flex-wrap justify-end gap-1">
            <button onClick={() => setShowLabels((v) => !v)} className={optBtn(showLabels)} title="Toggle labels [L]">
              labels
            </button>
            <button onClick={() => setSizeBy((s) => (s === "impact" ? "equal" : "impact"))} className={optBtn(sizeBy === "impact")} title="Node size [S]">
              {isMobile ? "sz" : "size"}:{sizeBy === "impact" ? "deg" : "eq"}
            </button>
            <button onClick={() => setColorBy((c) => (c === "kind" ? "language" : c === "language" ? "cluster" : "kind"))} className={optBtn(colorBy !== "kind")} title="Color mode (kind / language / community)">
              {colorBy === "kind" ? "kind" : colorBy === "language" ? "lang" : "comm"}
            </button>
            <button onClick={() => setConnectedOnly((v) => !v)} className={optBtn(connectedOnly)} title="Connected only [C]">
              {isMobile ? "lnk" : "linked"}
            </button>
            <button onClick={() => { if (simRef.current) { simRef.current.nodes().forEach((d: any) => { d.fx = null; d.fy = null; }); simRef.current.alpha(1).restart(); } }} className={optBtn(false)} title="Re-run layout [R]">
              <Shuffle size={10} />
            </button>
            <button onClick={() => { setGraphSelectMode((v) => !v); if (!graphSelectMode) setGraphSelected(new Set()); }} className={optBtn(graphSelectMode)} title="Select nodes [X]">
              {isMobile ? "sel" : "select"}
            </button>
            <button onClick={() => {
              const svg = svgRef.current;
              if (!svg) return;
              d3.select(svg).transition().duration(400).call(zoomRef.current!.transform as any, d3.zoomIdentity);
            }} className={optBtn(false)} title="Reset zoom">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35M8 11h6M11 8v6"/></svg>
            </button>
            <button onClick={toggleFullscreen} className={optBtn(fullscreen)} title="Fullscreen [F]">
              {fullscreen ? (
                <span className="flex items-center gap-1">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
                  </svg>
                  {isMobile && "exit"}
                </span>
              ) : (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2 2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                </svg>
              )}
            </button>
            <button onClick={() => setFocusMode((v) => !v)} className={optBtn(focusMode)} title="Focus mode — dim unconnected nodes">
              focus
            </button>
            <button
              onClick={() => setShowContributors((v) => !v)}
              className={optBtn(showContributors)}
              title="Show repo contributors as connected nodes (like Obsidian)"
            >
              {contribLoading ? <Loader2 size={11} className="animate-spin" /> : <Users size={11} />} contrib
            </button>
            {focusMode && focusNodeId && onExportSubgraph && (
              <button onClick={() => {
                const adj = new Set<string>([focusNodeId]);
                adjRef.current.forEach((targets, source) => {
                  if (source === focusNodeId) targets.forEach(t => adj.add(t));
                  if (targets.has(focusNodeId)) adj.add(source);
                });
                const ids = [...adj];
                onExportSubgraph(ids);
              }} className={optBtn(false)} title="Export focused subgraph">
                {isMobile ? "sub" : "export adj"}
              </button>
            )}
          </div>
        </div>

        {graphSelected.size > 0 && (
          <div className="absolute bottom-16 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 shadow-xl">
            <span className="font-mono text-[11px] text-[var(--text-2)]">{graphSelected.size} selected</span>
            <span className="h-4 w-px bg-[var(--border)]" />
            <button onClick={() => setGraphSelected(new Set())} className="rounded px-2 py-1 text-[11px] text-[var(--text-soft)] hover:bg-[var(--surface-2)]">Clear</button>
            <button onClick={() => {
              const ids = [...graphSelected];
              const devIds = ids.filter((id) => id.startsWith("dev:")).map((id) => id.slice(4));
              const repoIds = ids.filter((id) => id.startsWith("repo:")).map((id) => id.slice(5));
              if (devIds.length === 0 || repoIds.length === 0) {
                setToast("Select at least one dev and one repo");
                return;
              }
              const linkToast = `Linked ${devIds.length} dev × ${repoIds.length} repo`;
              setToast(linkToast);
              setTimeout(() => setToast(""), 2500);
            }} className="rounded px-2 py-1 text-[11px] text-[var(--violet-text)] hover:bg-[var(--violet-bg)]">Link</button>
            <button onClick={() => {
              const ids = [...graphSelected];
              const items = ids.map((id) => ({ id, kind: id.startsWith("dev:") ? "dev" : "repo" as const }));
              if (onExportSubgraph) onExportSubgraph(ids);
            }} className="rounded px-2 py-1 text-[11px] text-[var(--mint-text)] hover:bg-[var(--mint-bg)]">Export</button>
          </div>
        )}
        {selectedItem && (
          <div
            ref={detailRef}
            className={`animate-in z-20 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl flex flex-col ${
              isMobile
                ? "fixed inset-x-2 bottom-20 top-auto max-h-[55vh]"
                : `absolute ${detailSide === "left" ? "left-3" : "right-3"} top-3 w-64 max-h-[calc(100%-48px)]`
            }`}
          >
            <div className="flex items-center justify-between px-4 pt-3 pb-1 gap-2">
              <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-3)]">
                {selectedItem.kind === "dev" ? "Developer" : "Repository"}
              </span>
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => setDetailSide((s) => (s === "left" ? "right" : "left"))}
                  className="rounded p-1 text-[var(--text-3)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
                  title={`Move to ${detailSide === "left" ? "right" : "left"}`}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    {detailSide === "left" ? (
                      <path d="M21 12H3m10-8 8 8-8 8" />
                    ) : (
                      <path d="M3 12h18M11 4l-8 8 8 8" />
                    )}
                  </svg>
                </button>
                <button
                  onClick={() => {
                    const id = selectedItem.id;
                    const isPinned = pinnedRef.current.has(id);
                    if (isPinned) {
                      pinnedRef.current.delete(id);
                      const n = simRef.current?.nodes().find((n: any) => n.id === id) as any;
                      if (n) { n.fx = null; n.fy = null; }
                    } else {
                      pinnedRef.current.add(id);
                      const n = simRef.current?.nodes().find((n: any) => n.id === id) as any;
                      if (n) { n.fx = n.x; n.fy = n.y; }
                    }
                    if (simRef.current) simRef.current.alpha(0.1).restart();
                    setPinVersion((v) => v + 1);
                  }}
                  className={`rounded p-1 ${pinnedRef.current.has(selectedItem.id) ? "text-[var(--amber-text)]" : "text-[var(--text-3)] hover:text-[var(--text)]"}`}
                  title={pinnedRef.current.has(selectedItem.id) ? "Unpin node" : "Pin node position"}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2z"/></svg>
                </button>
                <button onClick={() => setSelected(null)} className="rounded p-1 text-[var(--text-3)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]" aria-label="Close details">
                  <X size={13} />
                </button>
              </div>
            </div>
              <div className="list-scroll space-y-3 overflow-y-auto px-4 pb-4 pt-1 text-[12px]">
                {selectedItem.kind === "dev" && (selectedItem.data as any).isContributor ? (
                  <>
                    <div className="flex items-center gap-3">
                      {selectedItem.data.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={selectedItem.data.avatar_url} alt="" className="h-10 w-10 rounded-full border border-[var(--border-subtle)]" />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--surface-2)] text-[var(--amber-text)]"><Users size={16} /></div>
                      )}
                      <div className="min-w-0">
                        <div className="font-display text-[15px] font-semibold text-[var(--text)]">{selectedItem.data.username}</div>
                        <span className="rounded-full bg-[var(--amber-bg)] px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-[var(--amber-text)]">contributor</span>
                      </div>
                    </div>
                    <p className="text-[var(--text-2)]">
                      {selectedItem.data.contributions} commits
                      {(selectedItem.data.linkedRepos || []).length > 0 && <> · on {(selectedItem.data.linkedRepos || []).join(", ")}</>}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      <a href={`https://github.com/${selectedItem.data.username}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2 py-0.5 font-mono text-[11px] text-[var(--text-2)] hover:text-[var(--text)]">
                        <ExternalLink size={10} /> profile
                      </a>
                    </div>
                    {onAddDev && (
                      <button
                        onClick={() => onAddDev(selectedItem.data.username)}
                        className="flex w-full items-center justify-center gap-1.5 rounded-md border border-[var(--violet-text)] px-3 py-1.5 text-[12px] text-[var(--violet-text)] hover:bg-[var(--violet-text)] hover:text-white"
                      >
                        <Plus size={12} /> Add to tracking
                      </button>
                    )}
                  </>
                ) : selectedItem.kind === "dev" ? (
                  <>
                  <div>
                    <div className="font-display text-[15px] font-semibold text-[var(--text)]">
                      {selectedItem.data.name || selectedItem.data.username}
                    </div>
                    <a href={`https://github.com/${selectedItem.data.username}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 font-mono text-[11px] text-[var(--text-2)] hover:text-[var(--violet-text)]">
                      @{selectedItem.data.username} <ExternalLink size={10} />
                    </a>
                  </div>
                  {selectedItem.data.bio && <p className="text-[var(--text-2)]">{selectedItem.data.bio}</p>}
                  <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px] text-[var(--text-3)]">
                    <span className="flex items-center gap-1"><Users size={11} /> {selectedItem.data.followers ?? "—"}</span>
                    {selectedItem.data.location && <span>{selectedItem.data.location}</span>}
                    <span className="flex items-center gap-1" title={selectedItem.data.lastSynced ? formatDateTime(selectedItem.data.lastSynced) : undefined}><Clock size={11} /> {syncLabel(selectedItem.data.lastSynced)}</span>
                  </div>
                  {(selectedItem.data.tags || []).length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {(selectedItem.data.tags || []).map((t) => <Chip key={t} tone="violet">{t}</Chip>)}
                    </div>
                  )}
                  <div>
                    <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-[var(--text-3)]">Linked repos ({selectedItem.data.linkedRepos?.length || 0})</div>
                    <div className="flex flex-wrap gap-1.5">
                      {(selectedItem.data.linkedRepos || []).map((r) => (
                        <button key={r} onClick={() => { setSelected(`repo:${r}`); panToNode(`repo:${r}`); }} className="inline-flex items-center gap-1 rounded-full border border-[var(--mint-border)] bg-[var(--mint-bg)] px-2 py-0.5 font-mono text-[11px] text-[var(--mint-text)] hover:opacity-80">
                          <FolderGit2 size={10} /> {r}
                        </button>
                      ))}
                      {(selectedItem.data.linkedRepos || []).length === 0 && <span className="text-[var(--text-3)]">none</span>}
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-[var(--text-3)]">Recent GitHub activity</div>
                    {activity.loading ? (
                      <div className="flex items-center gap-2 text-[11px] text-[var(--text-3)]"><Loader2 size={12} className="animate-spin" /> loading…</div>
                    ) : activity.error ? (
                      <p className="text-[11px] text-[var(--text-3)]">{activity.error}</p>
                    ) : activity.events.length === 0 ? (
                      <p className="text-[11px] text-[var(--text-3)]">No recent public activity.</p>
                    ) : (
                      <div className="list-scroll max-h-48 space-y-2 overflow-y-auto pr-1">
                        {activity.events.map((ev: any) => (
                          <div key={ev.id} className="border-l-2 border-[var(--border)] pl-2">
                            <div className="text-[11px] text-[var(--text-2)]">{ev.summary}</div>
                            <div className="font-mono text-[10px] text-[var(--text-4)]">{timeAgo(ev.created_at)}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <div className="font-display text-[15px] font-semibold text-[var(--text)]">{selectedItem.data.fullName}</div>
                    <a href={selectedItem.data.htmlUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 font-mono text-[11px] text-[var(--text-2)] hover:text-[var(--mint-text)]">
                      view <ExternalLink size={10} />
                    </a>
                  </div>
                  {selectedItem.data.description && <p className="text-[var(--text-2)]">{selectedItem.data.description}</p>}
                  <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px] text-[var(--text-3)]">
                    <span className="flex items-center gap-1"><Star size={11} /> {selectedItem.data.stars ?? "—"}</span>
                    {selectedItem.data.language && (
                      <span className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full" style={{ background: languageColor(selectedItem.data.language) }} /> {selectedItem.data.language}
                      </span>
                    )}
                    <span className="flex items-center gap-1" title={selectedItem.data.lastCommit ? formatDateTime(selectedItem.data.lastCommit) : undefined}><GitCommit size={11} /> {selectedItem.data.lastCommit ? syncLabel(selectedItem.data.lastCommit) : "—"}</span>
                    <span className="flex items-center gap-1" title={selectedItem.data.lastSynced ? formatDateTime(selectedItem.data.lastSynced) : undefined}><Clock size={11} /> {syncLabel(selectedItem.data.lastSynced)}</span>
                  </div>
                  {(selectedItem.data.tags || []).length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {(selectedItem.data.tags || []).map((t) => <Chip key={t} tone="amber">{t}</Chip>)}
                    </div>
                  )}
                  <div>
                    <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-[var(--text-3)]">Linked developers ({selectedItem.data.linkedDevs?.length || 0})</div>
                    <div className="flex flex-wrap gap-1.5">
                      {(selectedItem.data.linkedDevs || []).map((u) => (
                        <button key={u} onClick={() => { setSelected(`dev:${u}`); panToNode(`dev:${u}`); }} className="inline-flex items-center gap-1 rounded-full border border-[var(--violet-border)] bg-[var(--violet-bg)] px-2 py-0.5 font-mono text-[11px] text-[var(--violet-text)] hover:opacity-80">
                          <User size={10} /> {u}
                        </button>
                      ))}
                      {(selectedItem.data.linkedDevs || []).length === 0 && <span className="text-[var(--text-3)]">none</span>}
                    </div>
                  </div>
                </>
              )}
              {selectedItem.data.notes?.trim() && (
                <div>
                  <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-[var(--text-3)]">Notes</div>
                  <div className="prose-sm leading-relaxed">{renderBasicMarkdownLines(selectedItem.data.notes)}</div>
                </div>
              )}
              {(selectedItem.data.stickyNotes || []).length > 0 && (
                <div>
                  <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-[var(--text-3)]">Sticky notes</div>
                  <div className="space-y-1.5">
                    {(selectedItem.data.stickyNotes || []).map((sn) => (
                      <StickyNoteCard key={sn.id} note={sn} onUpdate={() => {}} onDelete={() => {}} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        {hover?.item && hover.item.id !== selected && (() => {
          const hi = hover.item!;
          const flipX = hover.x > dimensions.width - 250;
          const flipY = hover.y > dimensions.height - 170;
          const style = {
            left: flipX ? hover.x - 250 : hover.x + 14,
            top: flipY ? hover.y - 170 : hover.y + 14,
          };
          return (
            <div
              className="animate-in pointer-events-none absolute z-30 w-60 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-[12px] shadow-2xl"
              style={style}
            >
              <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-3)]">
                {hi.kind === "dev" ? "Developer" : "Repository"}
              </div>
              <div className="font-display mb-1 mt-0.5 text-[14px] font-semibold text-[var(--text)]">
                {hi.kind === "dev" ? (hi.data.name || hi.data.username) : hi.data.fullName}
              </div>
              {hi.kind === "dev" ? (
                <div className="space-y-0.5">
                  <div className="font-mono text-[11px] text-[var(--text-2)]">@{hi.data.username}</div>
                  <div className="flex items-center gap-1 font-mono text-[11px] text-[var(--text-3)]"><Users size={11} /> {hi.data.followers ?? "—"}</div>
                  <div className="flex items-center gap-1 font-mono text-[11px] text-[var(--text-3)]"><Clock size={11} /> {syncLabel(hi.data.lastSynced)}</div>
                  <div className="font-mono text-[11px] text-[var(--text-3)]">{hi.data.linkedRepos?.length || 0} linked repos</div>
                </div>
              ) : (
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1 font-mono text-[11px] text-[var(--text-3)]"><Star size={11} /> {hi.data.stars ?? "—"}</div>
                  {hi.data.language && (
                    <div className="flex items-center gap-1 font-mono text-[11px] text-[var(--text-3)]">
                      <span className="h-2 w-2 rounded-full" style={{ background: languageColor(hi.data.language) }} /> {hi.data.language}
                    </div>
                  )}
                  <div className="flex items-center gap-1 font-mono text-[11px] text-[var(--text-3)]"><GitCommit size={11} /> {hi.data.lastCommit ? syncLabel(hi.data.lastCommit) : "—"}</div>
                  <div className="font-mono text-[11px] text-[var(--text-3)]">{hi.data.linkedDevs?.length || 0} linked devs</div>
                </div>
              )}
            </div>
          );
        })()}

        <div ref={exportAreaRef} className="pointer-events-none">
          {showExportPopup && <div className="fixed inset-0 z-[150] pointer-events-auto" onClick={() => setShowExportPopup(false)} />}
          <div className={`pointer-events-auto fixed z-[200] ${isMobile && selectedItem ? "right-3 top-3" : selectedItem ? (detailSide === "right" ? "bottom-20 left-4" : "bottom-20 right-4") : "bottom-20 right-4"}`}>
            <button onClick={() => setShowExportPopup((v) => !v)} className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--text-2)] shadow-lg hover:text-[var(--text)] hover:shadow-xl" title="Export as PNG">
              <Download size={12} />
            </button>
            {showExportPopup && (
              <div className={`${isMobile ? "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[200]" : "absolute right-0 bottom-full mb-2 z-[200]"} pointer-events-auto flex w-44 flex-col gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-xl`}>
                {selectedItem ? (
                  <>
                    <div className="px-1 pb-0.5 font-mono text-[9px] uppercase tracking-wide text-[var(--text-3)]">
                      Focus · {selectedItem.kind}
                    </div>
                    <button onPointerDown={(e) => e.stopPropagation()} onClick={() => { setShowExportPopup(false); exportPng("dark", selectedItem); }} className="flex items-center gap-2 whitespace-nowrap rounded px-3 py-1.5 text-[11px] text-[var(--text)] hover:bg-[var(--surface-2)]">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                      Focus · dark
                    </button>
                    <button onPointerDown={(e) => e.stopPropagation()} onClick={() => { setShowExportPopup(false); exportPng("light", selectedItem); }} className="flex items-center gap-2 whitespace-nowrap rounded px-3 py-1.5 text-[11px] text-[var(--text)] hover:bg-[var(--surface-2)]">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
                      Focus · light
                    </button>
                    <div className="my-0.5 h-px bg-[var(--border)]" />
                  </>
                ) : (
                  <div className="px-1 pb-1 font-mono text-[9px] text-[var(--text-3)]">Select a node to focus</div>
                )}
                <button onPointerDown={(e) => e.stopPropagation()} onClick={() => { setShowExportPopup(false); exportPng("dark"); }} className="flex items-center gap-2 whitespace-nowrap rounded px-3 py-1.5 text-[11px] text-[var(--text-2)] hover:bg-[var(--surface-2)]">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                  Full graph · dark
                </button>
                <button onPointerDown={(e) => e.stopPropagation()} onClick={() => { setShowExportPopup(false); exportPng("light"); }} className="flex items-center gap-2 whitespace-nowrap rounded px-3 py-1.5 text-[11px] text-[var(--text-2)] hover:bg-[var(--surface-2)]">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
                  Full graph · light
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

