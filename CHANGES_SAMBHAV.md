# What I Added & Changed — Sambhav Lamichhane
_Branch: sambhav-updates | Reviewing partner: Dylan Thomas_

## New Files Created
These files currently exist in the repo from this workstream (the separate `Presentation.jsx` / `Presentation.css` slide deck was removed; the Home scroll view is the presentation surface now).

- `frontend/src/PresentationScroll.jsx` — Long-form scroll narrative for the Home tab with section nav, progress, live tab jump points, and ▶ Present mode.
- `frontend/src/PresentationScroll.css` — Styles for the scroll narrative, sticky chrome, and responsive layout.
- `frontend/src/dataCache.js` — In-memory cache with TTL, tab-scoped invalidation, and stale-entry reads for offline fallback.
- `frontend/src/ErrorBoundary.jsx` — Error boundary around dashboard content.
- `frontend/src/TrendChart.jsx` — Analytics trend chart with sampling and SVG download.
- `frontend/src/ForecastTrendChart.jsx` — Forecast trend chart with sampling and SVG download.
- `frontend/src/formatters.js` — Shared formatters and query-string helper.
- `frontend/.env.example` — Documents `VITE_API_BASE_URL` for local and production builds.
- `package.json` (repo root) — `npm run dev` delegates to the frontend workspace.
- `backend/Procfile` — `web: uvicorn main:app --host 0.0.0.0 --port $PORT` for Railway.
- `backend/runtime.txt` — Python runtime pin (`python-3.11.0`).
- `backend/railway.json` — Railway build/deploy configuration (Nixpacks builder, start command).
- `CHANGES_SAMBHAV.md` — This changelog.

## Section 1 — Scrollable Presentation Page (Home)
The Home tab **is** the course presentation: one continuous scroll with labeled sections (problem, data, cleansing, pipeline, specs, software, results, staffing score, allocation, demo, takeaways, limitations). There is no separate 14-slide JSX deck. **▶ Present** toggles full-screen-style present mode (dashboard chrome hidden via `scroll-present-active`), **ArrowUp / ArrowDown** move between sections when focus is not in a form control, and on small viewports a **section indicator pill** shows progress in present mode. Side navigation on wide screens uses scroll-spy highlighting.

## Section 2 — Performance Improvements
- Tab-scoped in-memory cache (`dataCache.js`) with a five-minute freshness window; manual **↺ Refresh** clears the cache.
- `AbortController` plus shorter timeouts after the first successful backend response; stale cache can be shown with a warning toast when requests fail.
- Data loads are scoped to the active tab; map fetches only run on the Spatial Map tab.
- Forecast table uses incremental “Load more” rendering for large row sets.
- Charts are memoized components with optional downsampling beyond 200 points.
- Offline mode when `VITE_API_BASE_URL` is unset avoids hanging fetches on static hosting.

## Section 3 — Light Theme & Visual Redesign
Light theme with shared design tokens (`index.css`), Instrument Serif + DM Sans, purple accent, unified `.card` surfaces, and cohesive dashboard + narrative styling.

## Section 4 — UX Improvements
- URL state sync: tab, year range, neighborhood, and map year persist in query params; browser back/forward restores state; refresh preserves the view.
- Sortable neighborhood summary table with ↑↓ indicators on all numeric and name columns.
- Forecast table search (neighborhood name or month) and sort on key columns.
- Page title updates per tab (`Home · St. Paul Staffing`, `Analytics · …`, etc.).
- Keyboard shortcuts: **1–4** switch tabs (disabled on Home so the narrative is not interrupted); **?** toggles the shortcut hint on other tabs.
- SVG download on both trend charts.
- Empty state cards when analytics/forecast have no live data (offline or unreachable API).
- Meta tags in `index.html` for description, Open Graph, and author (sharing and submission context).
- Debounced year filters, collapsible filters on small screens, KPI tooltips, toast notifications, and map timelapse controls.

## Section 5 — Hotspot Map Improvements
Larger schematic map, five-tier color scale, sqrt-scaled bubbles, labels, hover tooltip, month badge, play/pause timelapse, and empty-state handling including a dedicated message when a **specific year** returns no months after load.

## Section 6 — Backend Deployment Setup
Railway-oriented deployment for the FastAPI app:
- `backend/Procfile`, `backend/runtime.txt`, `backend/railway.json`
- `DB_PATH` via `os.getenv("DB_PATH", …)` with a repo-relative default SQLite path; all queries use that path
- CORS restricted to explicit localhost and `https://dataminingfinal.vercel.app` origins (no wildcard `*`)
- README updated for cross-platform local setup and Railway ↔ Vercel wiring

## Section 7 — Accessibility & Code Quality
- Skip link, focus-visible styling, table `scope`, ARIA on charts and map, sortable column `aria-label`s with sort direction.
- `ErrorBoundary` on main dashboard content.
- Effect cleanup for timeouts, intervals, fetch abort, matchMedia listener, and toast timers on unmount.

## How to Run Locally

```bash
# 1. Install frontend dependencies
npm --prefix frontend install

# 2. Copy env file and set API URL
cp frontend/.env.example frontend/.env
# Edit .env: VITE_API_BASE_URL=http://127.0.0.1:8000

# 3. Start FastAPI backend (from backend directory)
cd backend
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
python -m pip install -r requirements.txt
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000

# 4. Start frontend (from repo root)
npm run dev
```

## Notes for Dylan
- `Presentation.jsx` and `Presentation.css` were removed; the Home tab scroll narrative with built-in **▶ Present** mode replaces the old slide deck.
- Backend deployment artifacts live under `backend/` — see README for Railway steps.
- The frontend reads `VITE_API_BASE_URL` at build time; after you deploy the API, set this in Vercel to the public Railway URL and redeploy.
