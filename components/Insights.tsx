"use client";

import { useEffect, useMemo, useRef } from "react";
import * as echarts from "echarts";
import { buildDigest } from "@/lib/analytics";

type InsightItem = { kind: "dev" | "repo"; id: string; data: any };

const ACCENTS = ["#a78bfa", "#5fd9a4", "#f0b429", "#7aa2f7", "#e06c9f", "#56b6c2", "#d19a66", "#98c379"];

function cssVar(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function EChart({ option, height = 260 }: { option: any; height?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const instance = echarts.init(el, null, { renderer: "canvas" });
    instanceRef.current = instance;
    instance.setOption(option, true);
    const ro = new ResizeObserver(() => instance.resize());
    ro.observe(el);
    return () => {
      ro.disconnect();
      instance.dispose();
      instanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    instanceRef.current?.setOption(option, true);
  }, [option]);

  return <div ref={ref} style={{ width: "100%", height }} />;
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="mb-2">
        <h3 className="font-display text-[14px] font-semibold text-[var(--text)]">{title}</h3>
        {subtitle && <p className="text-[11px] text-[var(--text-3)]">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-center">
      <div className="text-[24px] font-bold text-[var(--text)]">{value}</div>
      <div className="text-[11px] text-[var(--text-3)]">{label}</div>
    </div>
  );
}

export default function Insights({ items, digest }: { items: InsightItem[]; digest: { kind: string; text: string }[] }) {
  const { recommendations } = useMemo(() => {
    const devs = items.filter((i) => i.kind === "dev").map((i) => i.data);
    const repos = items.filter((i) => i.kind === "repo").map((i) => i.data);
    const trackedDevSet = new Set(devs.map((d: any) => d.username));
    const trackedRepoSet = new Set(repos.map((r: any) => r.fullName));

    // Build a bipartite adjacency: dev <-> repo
    const adjacency: Record<string, Set<string>> = {};
    for (const d of devs) {
      adjacency[`dev:${d.username}`] = new Set((d.linkedRepos || []).map((r: string) => `repo:${r}`));
    }
    for (const r of repos) {
      adjacency[`repo:${r.fullName}`] = new Set((r.linkedDevs || []).map((u: string) => `dev:${u}`));
    }

    const recommendDevs: Record<string, number> = {};
    const recommendRepos: Record<string, number> = {};

    for (const d of devs) {
      const seenRepos = adjacency[`dev:${d.username}`] || new Set<string>();
      for (const repoId of seenRepos) {
        const others = adjacency[repoId] || new Set<string>();
        for (const otherDevId of others) {
          const username = otherDevId.replace("dev:", "");
          if (!trackedDevSet.has(username)) {
            recommendDevs[username] = (recommendDevs[username] || 0) + 1;
          }
        }
      }
    }
    for (const r of repos) {
      const seenDevs = adjacency[`repo:${r.fullName}`] || new Set<string>();
      for (const devId of seenDevs) {
        const otherRepos = adjacency[devId] || new Set<string>();
        for (const otherRepoId of otherRepos) {
          const fullName = otherRepoId.replace("repo:", "");
          if (!trackedRepoSet.has(fullName)) {
            recommendRepos[fullName] = (recommendRepos[fullName] || 0) + 1;
          }
        }
      }
    }

    const devRecs = Object.entries(recommendDevs).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const repoRecs = Object.entries(recommendRepos).sort((a, b) => b[1] - a[1]).slice(0, 8);
    return { recommendations: { devRecs, repoRecs } };
  }, [items]);
  const textColor = cssVar("--text", "#e1e4e8");
  const subColor = cssVar("--text-3", "#8890a0");
  const borderColor = cssVar("--border", "#232a38");
  const bg = cssVar("--bg", "#0d1117");

  const {
    devCount, repoCount, langDist, sunburstData, treemapData,
    radarIndicators, radarData, heatmapData, heatmapX, heatmapY,
    topRepos, topDevs, tagRows, syncRows, linkRows, avgLinks, totalLinks,
    totalTags, totalLangs,
  } = useMemo(() => {
    const devs = items.filter((i) => i.kind === "dev").map((i) => i.data);
    const repos = items.filter((i) => i.kind === "repo").map((i) => i.data);

    const dCount = devs.length;
    const rCount = repos.length;

    const langCount: Record<string, number> = {};
    repos.forEach((r) => {
      const l = r.language || "Unknown";
      langCount[l] = (langCount[l] || 0) + 1;
    });
    const langDist = Object.entries(langCount)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }));
    const totalLangs = langDist.length;

    const sunburstData = langDist.map((ld) => ({
      name: ld.name,
      value: ld.value,
      children: repos
        .filter((r) => (r.language || "Unknown") === ld.name)
        .slice(0, 30)
        .map((r) => ({ name: r.fullName, value: r.stars || 1 })),
    }));

    const tagCount: Record<string, number> = {};
    [...devs, ...repos].forEach((x) => (x.tags || []).forEach((t: string) => (tagCount[t] = (tagCount[t] || 0) + 1)));
    const totalTags = Object.keys(tagCount).length;
    const tagRows = Object.entries(tagCount).sort((a, b) => b[1] - a[1]).slice(0, 20);
    const treemapData = tagRows.map(([name, value]) => ({ name, value }));

    const topDevs = [...devs].sort((a, b) => (b.followers || 0) - (a.followers || 0)).slice(0, 6);
    const maxFollowers = Math.max(...topDevs.map((d) => d.followers || 0), 1);
    const maxRepos = Math.max(...topDevs.map((d) => (d.linkedRepos || []).length), 1);
    const maxTags = Math.max(...topDevs.map((d) => (d.tags || []).length), 1);
    const radarIndicators = [
      { name: "Followers", max: maxFollowers },
      { name: "Repos", max: maxRepos },
      { name: "Tags", max: maxTags },
    ];
    const radarData = topDevs.map((d) => ({
      name: d.name || d.username,
      value: [d.followers || 0, (d.linkedRepos || []).length, (d.tags || []).length],
    }));

    const topLangs = langDist.slice(0, 8).map((l) => l.name);
    const topTags = tagRows.slice(0, 8).map(([t]) => t);
    const heatmapData: [number, number, number][] = [];
    topLangs.forEach((lang, li) => {
      topTags.forEach((tag, ti) => {
        const c = repos.filter(
          (r) => (r.language || "Unknown") === lang && (r.tags || []).includes(tag)
        ).length;
        heatmapData.push([ti, li, c]);
      });
    });

    const topRepos = [...repos].sort((a, b) => (b.stars || 0) - (a.stars || 0)).slice(0, 10);

    const linkedCounts = devs.map((d) => (d.linkedRepos || []).length);
    const totalLinks = linkedCounts.reduce((a, b) => a + b, 0);
    const avgLinks = linkedCounts.length ? (totalLinks / linkedCounts.length).toFixed(1) : "0";

    const now = Date.now();
    const buckets: Record<string, number> = { "≤7d": 0, "8–30d": 0, "31–90d": 0, ">90d": 0, never: 0 };
    const bucketize = (iso?: string | null) => {
      if (!iso) return "never";
      const d = (now - new Date(iso).getTime()) / 86400000;
      if (d <= 7) return "≤7d";
      if (d <= 30) return "8–30d";
      if (d <= 90) return "31–90d";
      return ">90d";
    };
    [...devs, ...repos].forEach((x) => buckets[bucketize(x.lastSynced)]++);
    const syncRows = Object.entries(buckets).map(([bucket, count]) => ({ bucket, count }));

    const linkHist: Record<number, number> = {};
    devs.forEach((d) => {
      const n = (d.linkedRepos || []).length;
      linkHist[n] = (linkHist[n] || 0) + 1;
    });
    const linkRows = Object.entries(linkHist)
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([links, count]) => ({ links: Number(links), count }));

    return {
      devCount: dCount,
      repoCount: rCount,
      langDist,
      sunburstData,
      treemapData,
      radarIndicators,
      radarData,
      heatmapData,
      heatmapX: topTags,
      heatmapY: topLangs,
      topRepos,
      topDevs,
      tagRows,
      syncRows,
      linkRows,
      avgLinks,
      totalLinks,
      totalTags,
      totalLangs,
    };
  }, [items]);

  const commonAxis = () => ({
    axisLine: { lineStyle: { color: borderColor } },
    axisLabel: { color: subColor, fontSize: 10 },
    splitLine: { lineStyle: { color: borderColor } },
  });

  const langPieOption = useMemo(() => {
    const data = langDist.map((l, i) => ({ name: l.name, value: l.value, itemStyle: { color: ACCENTS[i % ACCENTS.length] } }));
    return {
      tooltip: { trigger: "item" as const, formatter: "{b}: {c} ({d}%)" },
      series: [{
        type: "pie" as const,
        radius: ["40%", "65%"],
        avoidLabelOverlap: true,
        label: { color: textColor, fontSize: 10, formatter: "{b}" },
        emphasis: { label: { fontSize: 13, fontWeight: "bold" as const } },
        data,
      }],
    };
  }, [langDist, textColor]);

  const sunburstOption = useMemo(() => ({
    tooltip: { trigger: "item" as const, formatter: "{b}: {c}" },
    series: [{
      type: "sunburst" as const,
      data: sunburstData,
      radius: ["0%", "90%"],
      label: { color: textColor, fontSize: 10 },
      itemStyle: { borderRadius: 4, borderColor: bg, borderWidth: 1 },
    }],
  }), [sunburstData, textColor, bg]);

  const treemapOption = useMemo(() => ({
    tooltip: { trigger: "item" as const, formatter: "{b}: {c}" },
    series: [{
      type: "treemap" as const,
      data: treemapData,
      roam: false,
      label: { color: textColor, fontSize: 10 },
      itemStyle: { borderColor: bg, borderWidth: 1 },
    }],
  }), [treemapData, textColor, bg]);

  const radarOption = useMemo(() => ({
    tooltip: { trigger: "item" as const },
    legend: {
      data: radarData.map((r) => r.name),
      textStyle: { color: textColor, fontSize: 10 },
      bottom: 0,
    },
    radar: {
      indicator: radarIndicators,
      axisName: { color: subColor, fontSize: 10 },
      splitArea: { areaStyle: { color: ["rgba(167,139,250,0.05)", "rgba(167,139,250,0.02)"] } },
      axisLine: { lineStyle: { color: borderColor } },
      splitLine: { lineStyle: { color: borderColor } },
    },
    series: [{
      type: "radar" as const,
      data: radarData.map((r, i) => ({
        name: r.name,
        value: r.value,
        areaStyle: { color: ACCENTS[i % ACCENTS.length], opacity: 0.2 },
        lineStyle: { color: ACCENTS[i % ACCENTS.length], width: 1.5 },
        itemStyle: { color: ACCENTS[i % ACCENTS.length] },
      })),
    }],
  }), [radarData, radarIndicators, textColor, subColor, borderColor]);

  const heatmapOption = useMemo(() => {
    const maxVal = Math.max(...heatmapData.map((d) => d[2]), 1);
    return {
      tooltip: {
        formatter: (p: any) => `${heatmapY[p.value[1]]} × ${heatmapX[p.value[0]]}: ${p.value[2]}`,
      },
      xAxis: {
        type: "category" as const,
        data: heatmapX,
        axisLabel: { color: subColor, fontSize: 9, rotate: 30 },
        axisLine: { show: false },
        splitLine: { show: false },
      },
      yAxis: {
        type: "category" as const,
        data: heatmapY,
        axisLabel: { color: subColor, fontSize: 9 },
        axisLine: { show: false },
        splitLine: { show: false },
      },
      visualMap: {
        min: 0,
        max: maxVal,
        calculable: true,
        inRange: { color: ["#1a1a2e", "#a78bfa", "#5fd9a4"] },
        textStyle: { color: subColor, fontSize: 10 },
      },
      series: [{
        type: "heatmap" as const,
        data: heatmapData,
        label: { show: true, color: textColor, fontSize: 9 },
        emphasis: { itemStyle: { shadowBlur: 6, shadowColor: "rgba(0,0,0,0.3)" } },
      }],
    };
  }, [heatmapData, heatmapX, heatmapY, textColor, subColor]);

  const topReposOption = useMemo(() => ({
    tooltip: { trigger: "axis" as const, axisPointer: { type: "shadow" as const } },
    xAxis: { type: "value" as const, ...commonAxis() },
    yAxis: {
      type: "category" as const,
      data: topRepos.map((r) => r.fullName).reverse(),
      axisLabel: { color: textColor, fontSize: 9 },
      axisLine: { show: false },
    },
    series: [{
      type: "bar" as const,
      data: topRepos.map((r, i) => ({
        value: r.stars || 0,
        itemStyle: { color: ACCENTS[i % ACCENTS.length], borderRadius: [0, 4, 4, 0] },
      })).reverse(),
    }],
  }), [topRepos, textColor]);

  const topDevsOption = useMemo(() => ({
    tooltip: { trigger: "axis" as const, axisPointer: { type: "shadow" as const } },
    xAxis: { type: "value" as const, ...commonAxis() },
    yAxis: {
      type: "category" as const,
      data: topDevs.map((d) => d.name || d.username).reverse(),
      axisLabel: { color: textColor, fontSize: 9 },
      axisLine: { show: false },
    },
    series: [{
      type: "bar" as const,
      data: topDevs.map((d, i) => ({
        value: d.followers || 0,
        itemStyle: { color: ACCENTS[(i + 3) % ACCENTS.length], borderRadius: [0, 4, 4, 0] },
      })).reverse(),
    }],
  }), [topDevs, textColor]);

  const syncOption = useMemo(() => ({
    tooltip: { trigger: "axis" as const, axisPointer: { type: "shadow" as const } },
    xAxis: {
      type: "category" as const,
      data: syncRows.map((r) => r.bucket),
      axisLabel: { color: subColor, fontSize: 10 },
      axisLine: { lineStyle: { color: borderColor } },
    },
    yAxis: { type: "value" as const, ...commonAxis() },
    series: [{
      type: "bar" as const,
      data: syncRows.map((r, i) => ({
        value: r.count,
        itemStyle: { color: ACCENTS[i % ACCENTS.length], borderRadius: [4, 4, 0, 0] },
      })),
    }],
  }), [syncRows, subColor, borderColor]);

  const linkOption = useMemo(() => ({
    tooltip: { trigger: "axis" as const, axisPointer: { type: "shadow" as const } },
    xAxis: {
      type: "category" as const,
      data: linkRows.map((r) => String(r.links)),
      axisLabel: { color: subColor, fontSize: 10 },
      axisLine: { lineStyle: { color: borderColor } },
    },
    yAxis: { type: "value" as const, ...commonAxis() },
    series: [{
      type: "bar" as const,
      data: linkRows.map((r, i) => ({
        value: r.count,
        itemStyle: { color: ACCENTS[(i + 5) % ACCENTS.length], borderRadius: [4, 4, 0, 0] },
      })),
    }],
  }), [linkRows, subColor, borderColor]);

  const tagsOption = useMemo(() => ({
    tooltip: { trigger: "axis" as const, axisPointer: { type: "shadow" as const } },
    xAxis: { type: "value" as const, ...commonAxis() },
    yAxis: {
      type: "category" as const,
      data: tagRows.map(([t]) => t).reverse(),
      axisLabel: { color: textColor, fontSize: 9 },
      axisLine: { show: false },
    },
    series: [{
      type: "bar" as const,
      data: tagRows.map(([, c], i) => ({
        value: c,
        itemStyle: { color: ACCENTS[(i + 2) % ACCENTS.length], borderRadius: [0, 4, 4, 0] },
      })).reverse(),
    }],
  }), [tagRows, textColor]);

  if (items.length === 0) {
    return (
      <div className="mt-6 rounded-lg border border-dashed border-[var(--border)] py-10 text-center text-[13px] text-[var(--text-3)]">
        No items match the current filters — adjust your search or filters to see insights.
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-[18px] font-semibold text-[var(--text)]">Insights</h2>
        <span className="text-[11px] text-[var(--text-3)]">
          {devCount} developers · {repoCount} repositories · based on current filters
        </span>
      </div>

      {digest && digest.length > 0 && (
        <div className="mb-5 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--text-3)]">Weekly digest</span>
            <span className="rounded-full bg-[var(--mint-bg)] px-2 py-0.5 text-[10px] text-[var(--mint-text)]">last 7 days</span>
          </div>
          <ul className="space-y-1">
            {digest.map((e, i) => (
              <li key={i} className="flex items-center gap-2 text-[12px] text-[var(--text-2)]">
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                    e.kind === "new" ? "bg-[var(--mint-text)]" : e.kind === "stars" ? "bg-[var(--amber-text)]" : "bg-[var(--violet-text)]"
                  }`}
                />
                {e.text}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
        <StatCard label="Developers" value={devCount} />
        <StatCard label="Repositories" value={repoCount} />
        <StatCard label="Languages" value={totalLangs} />
        <StatCard label="Tags" value={totalTags} />
        <StatCard label="Total Links" value={totalLinks} />
        <StatCard label="Avg Links/Dev" value={avgLinks} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {langDist.length > 0 && (
          <ChartCard title="Languages" subtitle="Primary language distribution (donut)">
            <EChart option={langPieOption} />
          </ChartCard>
        )}
        {sunburstData.length > 0 && (
          <ChartCard title="Language Hierarchy" subtitle="Languages → repositories (sunburst)">
            <EChart option={sunburstOption} />
          </ChartCard>
        )}
        {treemapData.length > 0 && (
          <ChartCard title="Tags" subtitle="Most-used tags (treemap)">
            <EChart option={treemapOption} />
          </ChartCard>
        )}
        {radarData.length > 0 && (
          <ChartCard title="Top Developers Radar" subtitle="Top 6 devs compared by followers, repos, tags">
            <EChart option={radarOption} height={300} />
          </ChartCard>
        )}
        {heatmapData.length > 0 && heatmapX.length > 0 && heatmapY.length > 0 && (
          <ChartCard title="Language × Tag" subtitle="Co-occurrence heatmap">
            <EChart option={heatmapOption} />
          </ChartCard>
        )}
        {topRepos.length > 0 && (
          <ChartCard title="Top Repos by Stars" subtitle="Top 10 repositories">
            <EChart option={topReposOption} />
          </ChartCard>
        )}
        {topDevs.length > 0 && (
          <ChartCard title="Top Devs by Followers" subtitle="Top 10 developers">
            <EChart option={topDevsOption} />
          </ChartCard>
        )}
        {tagRows.length > 0 && (
          <ChartCard title="Tags (Horizontal Bar)" subtitle="Most-used tags by count">
            <EChart option={tagsOption} />
          </ChartCard>
        )}
        {syncRows.some((r) => r.count > 0) && (
          <ChartCard title="Sync Recency" subtitle="Last GitHub sync">
            <EChart option={syncOption} />
          </ChartCard>
        )}
        {linkRows.length > 0 && (
          <ChartCard title="Link Density" subtitle="Linked repos per developer">
            <EChart option={linkOption} />
          </ChartCard>
        )}

        {(recommendations.devRecs.length > 0 || recommendations.repoRecs.length > 0) && (
          <ChartCard title="Discover" subtitle="People & repos your network already connects to">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {recommendations.devRecs.length > 0 && (
                <div>
                  <div className="mb-1 text-[11px] uppercase tracking-wider text-[var(--text-3)]">Developers to track</div>
                  <div className="flex flex-wrap gap-1">
                    {recommendations.devRecs.map(([u, n]) => (
                      <a
                        key={u}
                        href={`https://github.com/${u}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2 py-0.5 text-[11px] text-[var(--violet-text)] hover:bg-[var(--violet-bg)]"
                        title={`${n} of your tracked devs link to repos ${u} contributes to`}
                      >
                        @{u} <span className="text-[var(--text-3)]">×{n}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
              {recommendations.repoRecs.length > 0 && (
                <div>
                  <div className="mb-1 text-[11px] uppercase tracking-wider text-[var(--text-3)]">Repos to track</div>
                  <div className="flex flex-wrap gap-1">
                    {recommendations.repoRecs.map(([f, n]) => (
                      <a
                        key={f}
                        href={`https://github.com/${f}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2 py-0.5 text-[11px] text-[var(--mint-text)] hover:bg-[var(--mint-bg)]"
                        title={`${n} of your tracked devs link to ${f}`}
                      >
                        {f} <span className="text-[var(--text-3)]">×{n}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ChartCard>
        )}
      </div>
    </div>
  );
}
