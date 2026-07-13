# Changelog

## [Unreleased]

### Added
- Full-width responsive layout (removed max-width caps on all views)
- PWA support with service worker, manifest, and auto-update
- Custom icon set (SVG + PNG for PWA)
- PNG export with legend/footer
- Markdown export (wikilink and plain Markdown variants)
- ECharts-based Insights dashboard:
  - Language donut, sunburst, treemap
  - Top developers radar
  - Language × tag co-occurrence heatmap
  - Top repos/devs horizontal bars
  - Sync recency and link density charts
  - Stat cards (devs, repos, languages, tags, links)
- Developer activity feed (GitHub events via API route)
- Drag-to-zoom and pan on graph view
- Focus mode, node selection, and subgraph export
- Theme toggle (light/dark)
- Tag and language filtering on all views

### Changed
- Migrated from Flint/Chart.js to ECharts for all visualizations
- Graph tooltip with hover information and edge-flipping position
- Node detail panel with pin, GitHub activity, and formatted timestamps
- `syncLabel` and `formatDateTime` helpers used throughout
- PNG export legend shows selected developer info when a dev node is selected
- PNG export now asks for dark/light background before exporting (prevents invisible text)
- Detail panel repositions below toolbar and can be toggled left/right
- Graph force collision increased to prevent label overlap
- Node labels use paint-order stroke for readability when nodes are close
- PNG export passes selected dev as explicit parameter (fixes stale closure)
- Fullscreen mode for graph view (button + Escape to exit)

### Fixed
- Dev info panel in PNG export now wraps tags/stats properly, shows stars/location/lang counts
- PNG export filename follows `rues-<dev>-<date>.png` pattern
- PNG dimming no longer targets parent `<g>` container (was hiding entire graph)
- Export dropdown no longer clipped by graph container `overflow-hidden`
- Fullscreen on mobile falls back to CSS `fixed inset-0` when native API unsupported
- Fullscreen exit button always visible when in fullscreen mode (no Esc key on mobile)
- Graph auto-fits to center after simulation settles (fixes nodes running off-screen)
- PNG export resolution uses `devicePixelRatio` for sharper output
- PNG info panel width adapts to viewport (`max(200px, 45vw)`) so it doesn't block the graph on mobile
- Mobile browser zoom prevented via viewport meta and `touch-action: manipulation`
- Export popup centered on mobile using fixed viewport positioning
- Graph action buttons moved to bottom bar (same level as filter/language chips)
- CSS fullscreen fallback now hides page chrome via fixed outer wrapper + body overflow hidden
- Desktop export popup opens upward (bottom-full) instead of off-screen downward
- Detail panel more compact on mobile (bottom sheet style, `max-h-[55vh]`)
- Fixed double-tap needed on mobile (switched from onMouseDown to onPointerDown)
- Detail panel width reduced from `w-72` to `w-64`, repositioned from `top-12` to `top-3`
- Export changed from toolbar button to floating FAB (bottom-right, always visible)
- Selected dev data stored in ref for reliable PNG export context
- Restored onPointerDown with stopPropagation on popup buttons (fixes mobile double-tap)
- Changed detail panel default side from right to left
- Fixed desktop export popup buttons not responding (FAB container z-index raised to z-50 to sit above backdrop)

### Removed
- Horizontal grid view (vertical grid remains, responsive up to 6 columns)
- `chart.js` and `flint-chart` dependencies
- HorizontalScroller component and gridDir state
- Unused `@keyframes pulse` CSS
