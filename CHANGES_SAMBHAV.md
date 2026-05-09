# What I Added & Changed — Sambhav Lamichhane
_Branch: sambhav-updates | Reviewing partner: Dylan Thomas_

## New Files Created
- `frontend/src/Presentation.jsx`: Adds a full-screen, keyboard-navigable 14-slide presentation mode embedded directly in the app.
- `frontend/src/Presentation.css`: Provides the presentation-mode slide styling, layout system, and control visuals.
- `frontend/src/PresentationScroll.jsx`: Implements a long-form scrollable 14-section narrative home page with section navigation and live tab jump points.
- `frontend/src/PresentationScroll.css`: Styles the scroll presentation experience, including sticky side nav, progress bar, section cards, and responsive behavior.
- `frontend/src/dataCache.js`: Adds a module-level 5-minute in-memory cache with tab-scoped invalidation and manual clear helpers.
- `frontend/src/ErrorBoundary.jsx`: Wraps dashboard content with a runtime error boundary and recovery UI.
- `frontend/src/TrendChart.jsx`: Extracts and memoizes the analytics trend chart into a dedicated component with sampled rendering for large datasets.
- `frontend/src/ForecastTrendChart.jsx`: Extracts and memoizes the forecast trend chart into a dedicated component with sampled rendering for performance.
- `frontend/src/formatters.js`: Centralizes shared formatting utilities for numbers, dates, labels, and query-string construction.
- `frontend/.env.example`: Documents the expected `VITE_API_BASE_URL` environment variable setup for local and deployed use.
- `package.json`: Adds a root-level `dev` script that delegates development startup to the frontend workspace.
- `CHANGES_SAMBHAV.md`: Records all Sambhav-authored additive and enhancement work since Dylan’s original pull.

## Section 1 — Presentation Slide Mode
`Presentation.jsx` introduces a full-viewport, in-site 14-slide deck that covers the full rubric narrative and can be launched from the dashboard. It supports keyboard navigation (arrow keys/space for movement, Escape to exit), includes a dedicated live demo slide that jumps directly into `Analytics`, `Forecast`, and `Spatial Map`, and is built with accessibility details such as clear ARIA labels, focus-visible behavior, and touch-friendly 44px controls.

## Section 2 — Scrollable Presentation Page (Home)
`PresentationScroll.jsx` provides a stacked, scroll-native 14-section presentation page that now serves as the default `Home` tab instead of a blank landing view. It includes a sticky side navigation with IntersectionObserver-based scroll-spy state, a 3px reading progress bar, and direct `onSwitchTab` action buttons in the demo section that jump users into live dashboard tabs for walkthroughs.

## Section 3 — Light Theme & Visual Redesign (Site-Wide)
The UI theme was redesigned from dark navy to a light visual system across dashboard and presentation surfaces for readability and polish in demos. Core palette and tokens now center around `#f0f2f7` page backgrounds, white cards, `#0f172a` text, and `#6d28d9` accents, with consolidated CSS variables (`--space-*`, `--text-*`, `--shadow-sm`, `--shadow-md`), unified `.card` styling, consistent radius rules, and a clear typographic hierarchy using Instrument Serif for display and DM Sans for body/interface copy.

## Section 4 — Performance Improvements

**IN-MEMORY CACHE (`dataCache.js`)**  
Added a tab-aware Map cache with a 5-minute TTL keyed by tab plus active filter signature, so revisiting recently viewed states resolves instantly without re-fetching. On valid cache hit, data is set immediately and loading UI is skipped; on filter changes, only the active tab cache is invalidated; and a manual `↺ Refresh` clears cache and rehydrates state. Successful foreground loads also schedule silent background preload of the adjacent data tab (Analytics preloads Forecast and vice versa) so likely next navigation is warmed.

**FETCH OPTIMIZATIONS**  
Network calls now use `AbortController` cancellation for stale in-flight requests during rapid filter edits and tab transitions. Timeout policy was tightened to 8s until first confirmed backend success and 4s thereafter using a module-level reachability flag, reducing perceived hangs. On failures, stale cached entries can be served intentionally as a continuity fallback with a warning toast, preserving usability during backend interruptions.

**TAB-SCOPED LOADING**  
Data effects were constrained to run only for the currently relevant view, reducing redundant and competing fetches. The map loading effect is guarded to run only when `activeTab === 'map'`, and category trend loading was isolated into its own analytics-scoped effect, preventing unnecessary work when users are on Forecast/Home/Map. This keeps network/CPU activity aligned with what is visible.

**VIRTUAL FORECAST TABLE**  
The forecast table now uses incremental rendering (initial 40 rows with “Load 40 more”), which reduces initial DOM size and paint cost on Forecast. This preserves full data access while eliminating expensive first-pass rendering of large row sets and making tab activation feel materially faster.

**CHART PERFORMANCE**  
Both chart components were extracted and wrapped with `React.memo()` to stop unrelated state changes from triggering chart re-renders. When dataset length exceeds 200 rows, data is downsampled to ~120 points while preserving first/last points, preventing oversized SVG path complexity and improving interaction/render smoothness.

**OFFLINE MODE**  
When `VITE_API_BASE_URL` is unset, the app now enters explicit offline mode immediately rather than attempting unreachable localhost fetches that stall startup. Users see a clear offline banner and can still use static/presentation experiences instantly, which also improves default behavior on static Vercel deployments where backend is not co-hosted.

## Section 5 — UX Improvements
- Descriptive empty states on all panels (not just “No data”).
- 300ms skeleton delay gate so cache hits avoid skeleton flash.
- Filter hint text: “Showing data from X to Y · all 17 neighborhoods”.
- Tab description line under the active tab.
- Year input validation (`min 2014`, `max 2026`) with invalid-range feedback.
- KPI card label rewrites in plain language.
- CSS tooltips on `ⓘ` icons for KPI metric explanations.
- Bottom-right auto-dismiss toast notifications (6s) replacing intrusive inline banners.
- Missing KPI display changed from `N/A` to `—`.
- 400ms debounced year inputs to prevent refetch-on-every-keystroke.
- “Live” badge in the dashboard header.
- Collapsible mobile filter bar with `Filters ▾` toggle.
- Horizontally scrollable tabs on mobile viewports.

## Section 6 — Hotspot Map Improvements
- Expanded SVG map canvas from `360×300` to `700×520`.
- Replaced single-purple intensity with a 5-tier scale (blue → green → amber → orange → red).
- Switched bubble sizing to square-root radius scaling for visual balance.
- Added CSS transitions on `r`/`fill`/`stroke` for smoother timelapse changes.
- Added short-name labels with white pill backgrounds and edge-aware placement.
- Added hover tooltip with full neighborhood name, actual count, predicted count, and tier.
- Repositioned neighborhood coordinates to better distribute points across full SVG geography.
- Added subtle geographic compass markers (`N/S/E/W`).
- Added prominent month badge above map content.
- Added amber visual state for active play/pause control.
- Added clearer no-data month/map empty-state treatment.

## Section 7 — Accessibility & Code Quality
- Skip link added in `frontend/index.html`.
- Global `:focus-visible` focus ring behavior added.
- `scope="col"` added on table headers.
- ARIA labels added to SVG charts using active filter context.
- `ErrorBoundary.jsx` wraps main dashboard content.
- `TrendChart.jsx` and `ForecastTrendChart.jsx` extracted from `App.jsx`.
- Shared `formatters.js` module introduced for reused presentation logic.
- Root `package.json` added with `npm run dev` delegation to frontend.
- `frontend/.env.example` added for standardized environment setup.

## How to Run Locally

```bash
# 1. Install frontend dependencies
npm --prefix frontend install

# 2. Copy env file and set API URL
cp frontend/.env.example frontend/.env
# Edit .env: VITE_API_BASE_URL=http://127.0.0.1:8000

# 3. Start FastAPI backend (from backend directory)
cd backend
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000

# 4. Start frontend (from repo root)
npm run dev
```

## Notes for Dylan
- All original backend code is unchanged.
- All original data pipeline scripts are unchanged.
- The main dashboard tabs (`Analytics`, `Forecast`, `Spatial Map`) work exactly as before — only additive enhancements were made.
- The `Presentation` and `Scroll` experiences are fully additive.
- `frontend/.env` is gitignored and must be created locally from `.env.example`.
