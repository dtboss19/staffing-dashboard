# Performance improvements for data fetching
_Exported on 5/9/2026 at 02:05:00 CDT from Cursor (3.1.15)_

---

**User**

Reading through the full transcript, I can see exactly what's slow and why. The core problem is **no caching** — every tab switch re-fetches everything from scratch, and if the backend is on a cold server or a different machine than the browser, each fetch also pays full network latency. Here's the prompt:

---

```
Read all files in frontend/src/ before changing anything.

You are fixing three layered performance problems that make the site feel slow:

  1. No cache — every tab switch re-fetches all API data from zero
  2. No background preloading — data only starts loading after the user clicks
  3. No graceful degradation — when the backend is slow or unreachable the UI 
     just shows skeletons/errors with no fallback

Fix all three, then do the presentation-readiness pass at the end.
Do NOT ask for confirmation between sections. Work through each in order.

════════════════════════════════════════════════════════════════
FIX 1 — IN-MEMORY DATA CACHE  (biggest single win)
════════════════════════════════════════════════════════════════

Create frontend/src/dataCache.js — a simple module-level Map-based cache:

```js
// dataCache.js
const cache = new Map()

// key: string  value: { data, timestamp }
// maxAge: ms before a cached entry is considered stale (default 5 minutes)
export function getCached(key, maxAgeMs = 5 * 60 * 1000) {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() - entry.timestamp > maxAgeMs) { cache.delete(key); return null }
  return entry.data
}

export function setCached(key, data) {
  cache.set(key, { data, timestamp: Date.now() })
}

export function clearCache() {
  cache.clear()
}

export function invalidateTab(tab) {
  for (const key of cache.keys()) {
    if (key.startsWith(tab + ':')) cache.delete(key)
  }
}
```

In App.jsx, import getCached, setCached, clearCache, invalidateTab from dataCache.

When a data-fetching useEffect runs:
- Build a cache key: `${activeTab}:${startYear}-${endYear}-${neighborhoodNumber || 'all'}`
  For tab-specific sub-keys use e.g. `analytics:${startYear}-${endYear}-${nb}`
- BEFORE fetching, call getCached(key). If it returns data, set state immediately 
  from the cached value and set isLoading to false — do not fetch at all.
- AFTER a successful fetch, call setCached(key, data) before setting state.

Add a small "↺ Refresh" icon button next to the filter hint line. On click, call 
clearCache() then re-trigger the data effect. This gives users manual control 
without constant polling.

When filters change (year or neighborhood), call invalidateTab(activeTab) so only 
the current tab's cache is invalidated — not the other tabs.

════════════════════════════════════════════════════════════════
FIX 2 — BACKGROUND PRELOADING
════════════════════════════════════════════════════════════════

After the active tab's data resolves successfully, schedule a low-priority background 
fetch for the OTHER data tabs using requestIdleCallback (with a setTimeout(fn, 200) 
fallback for browsers that don't support it).

Rules:
- Only preload if the cache for that tab+filter combo is empty
- Preload order: if on Analytics, preload Forecast next. If on Forecast, preload 
  Analytics next. Never preload map data in the background (it's heavy).
- Preload silently — do NOT update any loading state, do NOT update any visible 
  state. Only call setCached(key, data). When the user actually switches to that 
  tab, getCached will return data instantly and the tab will appear to load instantly.
- Wrap the entire preload block in a try/catch with an empty catch — preload 
  failures must never surface as errors.

════════════════════════════════════════════════════════════════
FIX 3 — SMARTER TIMEOUT AND FAILURE HANDLING
════════════════════════════════════════════════════════════════

The current 12s timeout is too long. Change it:
- FIRST request after page load: 8s timeout (backend might be cold-starting)
- All subsequent requests: 4s timeout (if it was reachable once, it should be fast)

Track whether at least one successful response has been received in a module-level 
boolean in App.jsx: let backendReachable = false. Set to true on first success.
Use this to switch between 8s and 4s.

When a fetch fails (timeout OR network error):
- If getCached(key) returns stale data (i.e., exists but older than maxAge), 
  USE IT ANYWAY and show a small non-blocking amber banner:
  "Showing cached data — backend may be offline" with an X to dismiss.
  This means the dashboard stays usable during brief backend downtime.
- If there is no cached data at all, show the current skeleton + error state.

The "Backend is not reachable. Start FastAPI on port 8000." message should only 
appear after 2 failed attempts, not the first failure — add a retryCount ref.

════════════════════════════════════════════════════════════════
FIX 4 — VIRTUAL TABLE FOR FORECAST (removes biggest render bottleneck)
════════════════════════════════════════════════════════════════

The forecast table can have hundreds of rows × 14 columns. Rendering all of them 
at once is the main reason the Forecast tab feels sluggish on first load.

Replace the forecast table body with a simple windowed renderer:
- Track a visibleStart state (starts at 0)
- Only render rows visibleStart to visibleStart + 40 (40 rows at a time)
- Below the table, show a "Load more" button: "Showing [min(40,total)] of [total] rows — Load 40 more"
- On click: visibleStart += 40 (shows next 40 rows — cumulative, not paginated)
- Above the table: a compact summary line "17 neighborhoods · [distinct months] months · Mar–Dec 2026"

Do NOT use any virtualisation library. This simple slice + load-more is enough 
and has zero dependencies.

════════════════════════════════════════════════════════════════
FIX 5 — CHART RENDER PERFORMANCE
════════════════════════════════════════════════════════════════

Both TrendChart and ForecastTrendChart re-render on every state update in App 
because they are passed rows directly. Wrap both components in React.memo().

In TrendChart.jsx and ForecastTrendChart.jsx:
  export default React.memo(TrendChart)
  export default React.memo(ForecastTrendChart)

Also: if rows.length > 200, downsample the data for rendering:
  - Keep every Nth row so the rendered array stays under 120 points
  - N = Math.ceil(rows.length / 120)
  - Always keep first and last row
  - Add a note below the chart: "Chart shows sampled view of [rows.length] data points"
  This prevents SVG path elements from being enormous.

════════════════════════════════════════════════════════════════
FIX 6 — REMOVE REDUNDANT PARALLEL FETCHES
════════════════════════════════════════════════════════════════

Audit the current data effects. Specifically:

- The map data useEffect currently runs whenever mapYear changes. If the user is 
  NOT on the map tab, this should not run at all. Add: 
  if (activeTab !== 'map') return  — as the first line of the map data effect.

- The category trend effect (selectedCategory / selectedCategoryYear) runs as 
  part of the main dashboard effect. Move it to its own isolated useEffect with 
  dependencies [selectedCategory, selectedCategoryYear, filters.neighborhoodNumber, 
  activeTab] — and only run when activeTab === 'analytics'. This prevents it from 
  running on every filter change when on a different tab.

- The filters fetch (/filters endpoint) should only run ONCE on mount, not on 
  every render. Verify it has [] as dependency array and has no accidental 
  dependency on other state.

════════════════════════════════════════════════════════════════
FIX 7 — ENVIRONMENT CONFIG FOR PRODUCTION
════════════════════════════════════════════════════════════════

The current code falls back to http://127.0.0.1:8000 when VITE_API_BASE_URL 
is not set. This causes all fetches to fail with "connection refused" when 
the site is open on dataminingfinal.vercel.app (there's no backend there).

Do these two things:

1. Create frontend/.env.example with content:
     VITE_API_BASE_URL=http://127.0.0.1:8000
   Add a comment: # For production, set this to your deployed API URL

2. In App.jsx, update the API_BASE_URL logic:
     const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''
   If it resolves to an empty string (not set at all), set a module-level 
   constant OFFLINE_MODE = true and skip ALL data fetches. Instead of showing 
   loading skeletons, show a single centered banner:
     "Dashboard running in offline mode — connect a FastAPI backend to see live data"
     "dataminingfinal.vercel.app is the static frontend only"
   with a link to the README for setup instructions.
   
   This means the Vercel deployment loads INSTANTLY (no hanging fetches) and 
   the Home scroll page works perfectly since it has no data dependency.

════════════════════════════════════════════════════════════════
FIX 8 — PRESENTATION-READINESS POLISH
════════════════════════════════════════════════════════════════

These are the things that look bad during a live demo:

TAB SWITCHING: When switching tabs, if cached data exists, the content should 
appear in under 16ms (one frame). Verify there is no artificial setTimeout or 
transition-delay on the main content area that adds visible lag. Remove any such 
delay.

LOADING FLASH: If data loads in under 300ms (cache hit), do not show the skeleton 
at all — only show the skeleton if loading takes longer than 300ms. Implement with:
  const [showSkeleton, setShowSkeleton] = useState(false)
  useEffect(() => {
    if (!isLoading) { setShowSkeleton(false); return }
    const t = setTimeout(() => setShowSkeleton(true), 300)
    return () => clearTimeout(t)
  }, [isLoading])
  // Render skeletons only when showSkeleton === true, otherwise render nothing 
  // (data will appear within 300ms so the flicker never happens on cache hits)

SCROLL HOME PAGE: The Home tab (PresentationScroll) must work even with no 
backend. Verify onSwitchTab buttons on the demo slide switch to the correct tab 
and do not trigger any data fetch until the user actually clicks into that tab.

KPI CARDS: If a KPI value is null or NaN, show "—" instead of "N/A". "—" reads 
as intentional placeholder; "N/A" reads as broken.

ERROR BANNER: If the amber "cached data" banner or any error message is visible, 
it should not be the first thing in the visual hierarchy. Move all banners to a 
fixed bottom-right toast (max-width 340px, z-index 9000, auto-dismiss after 6s 
with a progress bar). This keeps the main content clean during a demo.

TITLE SLIDE: On the Home scroll view, the first section (s-title) should be 
100% of the visible viewport height when first loaded — nothing above the fold 
except the header bar. Verify that the title section's min-height calculation 
accounts for the header height so it doesn't overflow or underflow.

FONT LOADING: Add font-display: swap to ensure text is readable during font load 
(fonts loaded via Google Fonts URL — append &display=swap to the URL in index.html 
if not already there, which it should be, but verify).

════════════════════════════════════════════════════════════════
STEP LAST — VERIFY AND DOCUMENT
════════════════════════════════════════════════════════════════

After all fixes:

1. Run npm run build — it must succeed with zero errors.

2. Do a mental "tab switch timing" audit:
   - First load (no cache): all data tabs should start showing content within 
     the backend response time (no extra JS delay)
   - Second visit to a tab (cache hit): content must appear in under 16ms
   - If backend is unreachable: site loads in under 500ms, shows offline banner, 
     Home page fully functional

3. Write at the top of dataCache.js a comment block explaining:
   - How the cache works
   - How to bust it (clearCache())
   - The stale-data fallback behavior
   - The 5-minute TTL and how to change it

4. Write at the top of App.jsx an updated audit comment listing every file 
   modified in this session and the 3 most impactful changes made.
```

---

**The three things that will have the most impact in order:**

**#1 is the cache** (Fix 1) — right now switching from Analytics back to Analytics after going to Forecast re-fetches everything. With the cache, every return visit to a tab is instant. This alone makes the site feel 10x faster.

**#2 is offline mode detection** (Fix 7) — on the Vercel URL, the site currently hangs for 8–12 seconds trying to reach `localhost:8000` which doesn't exist. With this fix, `dataminingfinal.vercel.app` loads in under a second and the Home page works perfectly.

**#3 is the 300ms skeleton delay** (Fix 8) — even when data is fast, the current code shows a flash of skeleton before data appears. With the delay gate, cache hits show zero skeleton — the data just appears.

---

**Cursor**

Got it. I’ll first **read every file in `frontend/src/`** (as required) to understand current fetch/effect flows and UI structure. Then I’ll implement fixes **1→8 in order** (cache → preload → timeout/fallback → forecast virtual rows → memo+downsample charts → remove redundant fetches → offline mode + `.env.example` → presentation polish), and finally I’ll run `npm run build` and add the requested audit comments.

Nice—`frontend/src/` is a small set (12 files), so I can fully read it quickly and then start implementing the cache + offline mode changes without guessing about any existing effects or components.

All `frontend/src/` files are now fully read. Next I’ll implement the cache module + App-side cache keys and refresh/invalidation first, then layer in offline-mode short-circuiting, timeout/backoff + stale fallback, background preloading, and finally the forecast table/windowing + chart memo/downsampling + toast-style demo polish.

Cache module is in place (with TTL, tab invalidation, full clear, and a raw entry getter to enable “use stale data anyway” fallback). Next I’ll rework `App.jsx` to use cache keys + refresh/invalidate, implement offline-mode short-circuit, and then split category-trend into its own effect with caching.

## ✅ Performance fixes implemented (Fixes 1–8 + verify)

### **Fix 1 — In-memory data cache**
- Added `frontend/src/dataCache.js` with Map-based cache, **5‑minute TTL**, `clearCache()`, `invalidateTab(tab)`, and `getCacheEntry()` for stale fallback.
- Updated `App.jsx` to use **tab-scoped keys**:  
  - `analytics:${startYear}-${endYear}-${nb||all}`  
  - `forecast:${startYear}-${endYear}-${nb||all}`  
  - `map:${mapYear}`
- **Cache-hit path** sets state immediately and **skips fetch entirely**.
- Added **↺ Refresh** button next to the filter hint row to `clearCache()` and retrigger effects.

### **Fix 2 — Background preloading**
- After a successful load:
  - If on **Analytics**, preloads **Forecast** in an idle callback.
  - If on **Forecast**, preloads **Analytics** in an idle callback.
- **Never preloads map**.
- Preload is silent: **only** `setCached()`, no loading UI, wrapped so failures never surface.

### **Fix 3 — Smarter timeout + graceful degradation**
- Timeouts now:
  - **8s** until the first successful response
  - **4s** after backend has been reachable once (`backendReachable = true`)
- On fetch failure:
  - If cache entry exists but is **stale**, UI uses it anyway and shows a **non-blocking amber toast**: “Showing cached data — backend may be offline”
- “Backend is not reachable…” now appears only after **2 failed attempts**, as a bottom-right toast (dismissible).

### **Fix 4 — Virtualized forecast table (simple windowing)**
- Forecast table now renders **only the first 40 rows**, with a **Load 40 more** button (cumulative).
- Added compact summary line above forecast table:  
  “X neighborhoods · Y months · Mar 2026–Dec 2026” (derived from rows)

### **Fix 5 — Chart render performance**
- `TrendChart.jsx` and `ForecastTrendChart.jsx` now export `default React.memo(...)`.
- If `rows.length > 200`, charts **downsample to ≤120 points** (keep first/last), and show:  
  “Chart shows sampled view of N data points”

### **Fix 6 — Remove redundant parallel fetches**
- **Map effect** already short-circuits unless `activeTab === 'map'`.
- **Category trend fetch** moved into its **own `useEffect`** and only runs when `activeTab === 'analytics'`.
- `/filters` fetch remains **mount-only** (`[]`) and now also respects offline mode.

### **Fix 7 — Production env + offline mode**
- Added `frontend/.env.example`:
  - `VITE_API_BASE_URL=http://127.0.0.1:8000`
  - comment for production
- Updated `App.jsx` API logic:
  - `const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''`
  - If empty: `OFFLINE_MODE = true` and **skip all fetches**
  - Shows a centered offline banner + link to a served README page

### **Fix 8 — Presentation-readiness polish**
- **300ms skeleton gate** implemented (`showSkeleton`) so cache hits don’t flash skeletons.
- Error/warn banners moved to **bottom-right toasts** (max-width 340px, z-index 9000, auto-dismiss 6s with progress bar).
- Home scroll title section updated to fill the first viewport in home layout via `PresentationScroll.css`.
- Verified Google Fonts in `frontend/index.html` already has `&display=swap`.

## ✅ Verification
- `npm run build` **passes successfully** (exit code 0).

## Files changed / added
- Added: `frontend/src/dataCache.js`
- Added: `frontend/.env.example`
- Added: `frontend/public/README.md`
- Updated: `frontend/src/App.jsx`
- Updated: `frontend/src/TrendChart.jsx`
- Updated: `frontend/src/ForecastTrendChart.jsx`
- Updated: `frontend/src/formatters.js`
- Updated: `frontend/src/App.css`
- Updated: `frontend/src/PresentationScroll.css`
- (Verified) `frontend/index.html` already had `display=swap`

---

**User**

connect the backend and pull live data

---

**Cursor**

Understood — I’ll wire the frontend to a running FastAPI backend and then start the backend so the dashboard can load live data instead of offline mode. I’m checking the project run commands first, then I’ll launch the server and verify connectivity.

Good news: your backend and frontend dev processes are already running in existing terminals. I’m now verifying backend health and then I’ll set `frontend/.env` and restart the frontend server so it stops using offline mode and pulls live API data.

I’ve set `frontend/.env` to point at `http://127.0.0.1:8000`. Next I’m restarting the Vite dev server so the new env variable is picked up (without restart, it stays in offline mode).

Backend is connected and serving live data locally now.

- Confirmed FastAPI is up: `http://127.0.0.1:8000/health` → `{"status":"ok"}`
- Confirmed data endpoint works: `http://127.0.0.1:8000/filters` returns full years/neighborhoods/categories payload
- Added `frontend/.env` with:
  - `VITE_API_BASE_URL=http://127.0.0.1:8000`
- Restarted Vite so env is applied:
  - Local app: [http://127.0.0.1:5173/](http://127.0.0.1:5173/)

Reload the local page once; it should exit offline mode and pull live backend data.

Note: `dataminingfinal.vercel.app` is still static-only unless you point `VITE_API_BASE_URL` to a deployed backend URL.

---

**User**

@/Users/sambhav/.cursor/projects/Users-sambhav-Desktop-staffing-dashboard/terminals/17.txt:7-18 fix

---

**Cursor**

I’m debugging this as a runtime issue from your terminal output (`ENOENT` at repo root). I’ll instrument a tiny debug script to capture exactly what `npm run dev` sees in root, clear this session’s log file, and then have you reproduce once so I can confirm the cause before applying the fix.

I’ve set up runtime instrumentation for this debug session and prepared a probe so we can confirm root cause from logs before finalizing the fix.

### Hypotheses being tested
1. **H1**: `npm run dev` fails at repo root because there is no root `package.json` (matches your ENOENT trace).
2. **H2**: Command is being run from the correct repo root, but npm expects scripts at root while this project’s app scripts live in `frontend/`.
3. **H3**: Project structure is valid (`frontend/package.json` exists), so failure is script-entrypoint configuration at root, not missing frontend files.
4. **H4**: Backend presence is unrelated to this specific error; failure occurs before any backend/frontend runtime startup.

I also attempted to clear the debug log file; it didn’t exist yet, which is fine for a first run.

<reproduction_steps>
1. From `/Users/sambhav/Desktop/staffing-dashboard`, run `npm run dev`.
2. Wait until the command prints output and returns to prompt.
3. Press Proceed/Mark as fixed when done.
</reproduction_steps>

---

**User**

Issue reproduced, please proceed.

---

**Cursor**

Great — I’ll read this session’s runtime log now, evaluate each hypothesis with evidence, then apply a confident fix and keep instrumentation in place for post-fix verification.

Runtime evidence analysis from your reproduction:

- **H1 (root missing package.json)**: **REJECTED now** — logs show `rootPackageExists: true` after we added root `package.json`:
  - `scripts/root-dev-probe.mjs` log entries at `.cursor/debug-21bd7c.log` lines 1–2
- **H2 (scripts live in frontend, root command needs delegation)**: **CONFIRMED** by project structure and prior terminal ENOENT; root-level `npm run dev` must route to `frontend`.
- **H3 (frontend/backend files exist)**: **CONFIRMED** — logs show `frontendPackageExists: true`, `backendMainExists: true`.
- **H4 (backend unrelated to ENOENT)**: **CONFIRMED** — ENOENT happened before any runtime startup and is resolved by root script configuration.

### Fix applied (with instrumentation retained)
- Added/kept root `package.json` and updated:
  - `dev` now runs probe log + delegates to frontend dev server:
  - `node scripts/root-dev-probe.mjs && npm --prefix frontend run dev -- --host 127.0.0.1`
- Kept instrumentation in `scripts/root-dev-probe.mjs` (H1/H2/H3 logging).
- Cleared current debug log file for a clean post-fix verification run.

<reproduction_steps>
1. From `/Users/sambhav/Desktop/staffing-dashboard`, run `npm run dev`.
2. Confirm it starts Vite from `frontend` (no ENOENT about root `package.json`).
3. Leave it running for 5 seconds so logs flush.
4. Press Proceed/Mark as fixed when done.
</reproduction_steps>

---

**User**

Issue reproduced, please proceed.

---

**Cursor**

I’ve got post-fix runtime proof that the error is resolved (`npm run dev` now starts Vite from `frontend`, no ENOENT). I’ll clean up the temporary instrumentation now and keep only the real fix.

Confirmed fixed with runtime evidence.

### Before/after proof
- **Before:** root `npm run dev` failed with `ENOENT` for missing `/Users/sambhav/Desktop/staffing-dashboard/package.json` (terminal lines 9–16).
- **After:** root `npm run dev` now runs:
  - `> staffing-dashboard-root@1.0.0 dev`
  - `> node scripts/root-dev-probe.mjs && npm --prefix frontend run dev -- --host 127.0.0.1`
  - then Vite starts successfully at `http://127.0.0.1:5174/` (terminal lines 31–43), proving the ENOENT path is resolved.

### Final cleanup completed
- Kept the actual fix:
  - `package.json` at repo root with:
    - `"dev": "npm --prefix frontend run dev -- --host 127.0.0.1"`
- Removed temporary debug instrumentation:
  - deleted `scripts/root-dev-probe.mjs`

Problem and fix in 1–2 lines:  
Root-level `npm run dev` failed because the repo root had no runnable script context for frontend; adding a root `package.json` with a `dev` script delegating to `frontend` fixes it, so running from root now starts Vite correctly.

---

**User**

fix this

---

**Cursor**

I’ll debug this crash with runtime evidence: first I’ll add targeted logs around `App` render/effects and category/forecast paths (likely crash points), clear the session log, and then have you reproduce once so I can identify the exact failing branch from log lines before applying the fix.

I’ve added runtime instrumentation and cleared the debug log for a clean run.

### Hypotheses being tested now
1. **H1**: A render-time exception is thrown in the analytics subtree (captured by `ErrorBoundary.componentDidCatch` with exact message + component stack).
2. **H2**: App state combination during analytics render (category/filter/loading/cached rows) is inconsistent and triggers the crash path.
3. **H3**: `/category-all-count-trend` row shape contains unexpected fields (e.g., missing `month_start`) causing a render-time failure in derived table logic.
4. **H4**: Crash is not network-failure-related; it happens after data/state transitions (validated by state snapshots preceding boundary error).
5. **H5**: Crash is isolated to analytics subtree, not global app shell (header/tabs remain intact while boundary fallback appears).

<reproduction_steps>
1. Keep backend and frontend dev servers running.
2. Open the app and switch to the Analytics tab until the error fallback appears.
3. Wait 3 seconds after the fallback appears.
4. Press Proceed/Mark as fixed when done.
</reproduction_steps>

---

**User**

Issue reproduced, please proceed.

---

**Cursor**

Log analysis gives a definitive root cause and we now have a targeted fix in place.

### Hypothesis results (with evidence)
- **H1 CONFIRMED**: render crash occurs in `TrendChart` with hook-order violation.  
  Evidence: `.cursor/debug-21bd7c.log` lines 3, 10, 17, 32 —  
  `"Rendered more hooks than during the previous render."` at `TrendChart`.
- **H2 CONFIRMED**: crash happens when analytics transitions from empty trend rows to populated rows.  
  Evidence: lines 2→4 (and repeated at 9→11, 16→18): `trendRowsCount` goes `0 -> 139` around the crash.
- **H3 REJECTED** for this crash: all-category shape is not the active failure path (no corresponding boundary stack traces tied to that branch).

### Fix applied with 100% confidence
- In `frontend/src/TrendChart.jsx`, moved `useRef` and `useState` **before** the early return so hooks are called consistently on every render (empty and non-empty rows).  
  This directly addresses the exact React error proven by logs.

I kept instrumentation active (as required) for post-fix verification.

<reproduction_steps>
1. Keep backend and frontend dev servers running.
2. Open the app, switch to Analytics, and repeat tab switches (Home ↔ Analytics ↔ Forecast) for 20 seconds.
3. Confirm the error boundary message does not appear.
4. Press Proceed/Mark as fixed when done.
</reproduction_steps>

---

**User**

Issue reproduced, please proceed.

---

**Cursor**

The post-fix logs prove a second hook-order crash in `ForecastTrendChart`, so I’m applying the same structural hook-order fix there now (with instrumentation still active), then I’ll clear logs for verification.

Runtime evidence update and fix applied:

- **New confirmed root cause**: Post-fix logs show the same hook-order violation in `ForecastTrendChart`:
  - `.cursor/debug-21bd7c.log` lines 30 and 35:
  - `"Rendered more hooks than during the previous render."` at `ForecastTrendChart`.
- **Why**: `ForecastTrendChart` had `useRef`/`useState` declared after an early return when rows are empty, so hooks count changed across renders.
- **Fix applied**: Moved `useRef` and `useState` above the early return in `frontend/src/ForecastTrendChart.jsx` (same pattern used to fix `TrendChart`).
- Instrumentation remains active, and logs are cleared for clean verification.

<reproduction_steps>
1. Keep backend and frontend dev servers running.
2. Open the app and switch across Home, Analytics, Forecast, and Map repeatedly for 30 seconds.
3. Confirm the error boundary message does not appear.
4. Press Proceed/Mark as fixed when done.
</reproduction_steps>

---

**User**

Issue reproduced, please proceed.

---

**Cursor**

Fixed and verified with runtime evidence.

- Logs from your post-fix run show **no `componentDidCatch` crash entries** and repeated successful tab transitions across Analytics/Forecast/Map/Scroll with stable state snapshots.
- Previously failing errors (`Rendered more hooks than during the previous render`) are no longer present in the verification log.
- Root cause was hook-order violations in both chart components when rows transitioned empty ↔ populated.

### Final proven fixes kept
- `frontend/src/TrendChart.jsx`: moved `useRef`/`useState` above early return.
- `frontend/src/ForecastTrendChart.jsx`: moved `useRef`/`useState` above early return.

### Debug instrumentation cleanup completed
- Removed temporary debug logging from:
  - `frontend/src/App.jsx`
  - `frontend/src/ErrorBoundary.jsx`

In short: the crash came from conditional hook execution in chart components, and both were corrected to keep hook order consistent across renders.

---

**User**

fix the ui for this. its hard to read, still keep the name, manage spacing

---

**Cursor**

I’ll clean up the hotspot map UI by removing overlapping inline neighborhood names on the SVG and adding a structured, readable neighborhood name panel with spacing. This will keep all names visible while making the map itself legible.

Updated — the map UI is now much easier to read while still keeping all neighborhood names.

What I changed:
- Kept bubbles on the map, but removed the overlapping inline name labels.
- Kept numeric IDs on bubbles for quick visual reference.
- Added a **Neighborhood Key** panel next to the map with:
  - number badge
  - full neighborhood name
- Improved spacing/layout with a responsive two-column design:
  - desktop: map + key side-by-side
  - smaller screens: stacked

Files updated:
- `frontend/src/App.jsx`
- `frontend/src/App.css`

If you want, I can do one more pass to reduce bubble overlap too (slightly shrinking max radius or adding subtle jitter for dense central neighborhoods) while keeping the same visual style.

---

**User**

no, just havig numbers makes it harder to follow

---

**Cursor**

Makes sense — I’ll switch from number-based mapping to a **color-based legend with full names**, so you can follow neighborhoods visually without decoding numbers.

Good call — I removed the number-decoding burden.

### What changed
- Replaced number-based map reading with **color-based mapping**:
  - each neighborhood bubble now has a distinct color
  - legend panel shows a matching color dot + full neighborhood name
- Removed numeric labels inside bubbles (so no more “just numbers” dependency).

### Updated files
- `frontend/src/App.jsx`
- `frontend/src/App.css`

If you want, I can also sort the legend by crime count for the selected month (highest first) so it’s easier to scan hotspots quickly during demos.

---

**User**

make the circle size = relative crime count for that month box smaller

---

**Cursor**

I’ll shrink that in-map legend box by reducing its panel dimensions and text size so it takes less visual space.

Done — I made that legend box smaller.

### Changes made
- Reduced legend panel size inside the SVG:
  - from `200x36` to `168x28`
- Repositioned text to fit the smaller panel
- Reduced legend text size to `10px`

Updated files:
- `frontend/src/App.jsx`
- `frontend/src/App.css`



---

**User**

i do not like this color thing either, have the names be on the graph

---

**Cursor**

Understood — I’ll remove the color-key approach and put neighborhood names directly on the map with connector lines and cleaner spacing so labels stay readable on-graph.

Done — I removed the color-legend approach and put names back **on the graph** with improved readability.

### What I changed
- Removed the side “Neighborhood Key” panel.
- Put neighborhood names directly on the map again.
- Added connector lines from each bubble to its label.
- Added text halo/stroke for readability over overlapping circles.
- Kept spacing managed using fixed label anchor positions to reduce collisions.

### Updated files
- `frontend/src/App.jsx`
- `frontend/src/App.css`

If you want next, I can tune just 2–3 specific labels that still feel crowded in your screenshot (usually around Summit/University, Union Park, and North End).

---

**User**

Read frontend/src/App.jsx and frontend/src/App.css before changing anything.
Find the HotspotMap component and the Spatial Map tab section. 
Rewrite ONLY the HotspotMap component and its associated CSS classes.
Do not touch any other component, any other tab, or any data-fetching logic.
The play/pause timelapse, the month scrubber, the mapYear selector, and all 
state management stay exactly as they are — only the visual rendering changes.

════════════════════════════════════════════════════════════════
THE CORE PROBLEMS TO FIX
════════════════════════════════════════════════════════════════

1. ViewBox is 360×300 — too small, everything is cramped and circles overlap
2. All circles are the same purple with only opacity — impossible to distinguish
   high from low crime at a glance
3. Labels are always-on text to the right of each circle — they overlap and 
   clip out of the SVG bounds
4. No animation between timelapse months — just instant snapping
5. No legend — viewer has no idea what circle size or color means
6. No prominent month display — the current month label is too small
7. Neighborhood numbers are illegible or missing inside circles

════════════════════════════════════════════════════════════════
FIX 1 — BIGGER, RESPONSIVE SVG
════════════════════════════════════════════════════════════════

Change the SVG to:
  width="100%"
  height="auto"
  viewBox="0 0 700 520"
  preserveAspectRatio="xMidYMid meet"
  style={{ display: 'block', maxHeight: '480px' }}

Scale all neighborhoodMapPositions coordinates proportionally from the old 
360×300 space into the new 700×520 space. Multiply every x by 1.94 and every 
y by 1.73. Then add padding: shift all x values by +20 and all y values by +20 
so no point is on the edge. Round to integers.

The resulting positions (old → new, already computed for you):
  1: {x:187, y:439}    2: {x:342, y:390}    3: {x:199, y:311}
  4: {x:363, y:335}    5: {x:482, y:328}    6: {x:419, y:249}
  7: {x:237, y:214}    8: {x:311, y:214}    9: {x:206, y:380}
  10:{x:321, y:145}   11:{x:385, y:186}   12:{x:451, y:213}
  13:{x:299, y:266}   14:{x:237, y:328}   15:{x:187, y:387}
  16:{x:264, y:294}   17:{x:529, y:290}

Background rect: fill #f8f9fc, stroke #e2e8f0, stroke-width 1, rx 12, 
inset 8px from all edges (x=8, y=8, width=684, height=504).

════════════════════════════════════════════════════════════════
FIX 2 — COLOR SCALE INSTEAD OF OPACITY
════════════════════════════════════════════════════════════════

Replace the single purple + opacity approach with a 5-step color ramp based 
on intensity (0.0 to 1.0 where 1.0 = highest crime count in the current month):

  intensity 0.00–0.20 → fill: #bfdbfe  stroke: #93c5fd  (pale blue — very low)
  intensity 0.20–0.40 → fill: #86efac  stroke: #4ade80  (green — low)
  intensity 0.40–0.60 → fill: #fde68a  stroke: #fbbf24  (amber — moderate)
  intensity 0.60–0.80 → fill: #fb923c  stroke: #f97316  (orange — high)
  intensity 0.80–1.00 → fill: #f87171  stroke: #ef4444  (red — very high)

Write a helper function getColorForIntensity(intensity) that returns 
{fill, stroke} based on the above bands.

Circle radius: use a square-root scale for better visual balance:
  const minR = 14
  const maxR = 46
  const radius = minR + Math.sqrt(intensity) * (maxR - minR)

This means a neighborhood with 0 crime gets radius 14 (still visible),
and the hottest neighborhood gets radius 46. Square root prevents one 
dominant neighborhood from visually crushing all others.

All circles: fill-opacity 0.82, stroke-width 1.5.

════════════════════════════════════════════════════════════════
FIX 3 — SMOOTH CSS TRANSITIONS BETWEEN MONTHS
════════════════════════════════════════════════════════════════

In App.css, add to the circle elements:
  .hotspot-circle {
    transition: r 0.45s cubic-bezier(0.4, 0, 0.2, 1),
                fill 0.45s ease,
                stroke 0.45s ease,
                fill-opacity 0.3s ease;
  }

SVG animates the `r`, `fill`, `stroke` attributes when they change via CSS 
transitions — this makes the timelapse smooth: circles grow, shrink, and 
shift color gradually instead of snapping.

For this to work, you MUST use the SVG `r` attribute (not CSS height/width), 
and the fill/stroke must be inline attributes (not CSS classes) since we're 
computing them dynamically. Set them as:
  <circle
    r={radius}
    fill={colors.fill}
    stroke={colors.stroke}
    ...
  />

════════════════════════════════════════════════════════════════
FIX 4 — LABELS: NUMBER INSIDE CIRCLE, NAME ON HOVER ONLY
════════════════════════════════════════════════════════════════

Remove all always-on text labels positioned to the right of circles.
Instead:

INSIDE THE CIRCLE — always show the neighborhood number when radius ≥ 20:
  <text
    x={pos.x}
    y={pos.y + 1}
    textAnchor="middle"
    dominantBaseline="middle"
    fontSize={Math.min(radius * 0.5, 14)}
    fontWeight="600"
    fill={intensity > 0.5 ? '#1e293b' : '#334155'}
    style={{ pointerEvents: 'none', userSelect: 'none' }}
  >
    {row.neighborhood_number}
  </text>

HOVER TOOLTIP — on mouseEnter on the circle group, show a floating tooltip 
positioned near the circle. Store hoveredNeighborhood state 
(null or {number, name, actual, predicted, x, y}). Render it as an SVG 
<foreignObject> OR as a positioned <div> overlaid on the SVG wrapper.

Use a <div> overlay approach (easier, more stylable):
- The hotspot-map-wrap div: position relative
- Tooltip div: position absolute, pointer-events none, z-index 10
- Position it at approximately (svgX / 700 * containerWidth, svgY / 520 * containerHeight)
  adjusted to avoid going off right/bottom edge
- Tooltip style: white bg, border 1px solid #e2e8f0, border-radius 8px, 
  padding 8px 12px, box-shadow 0 4px 12px rgba(0,0,0,0.1), font DM Sans 13px
- Tooltip content:
    [Neighborhood Name]         ← 13px 600-weight #0f172a
    Actual:  [value]            ← 12px #475569
    Predicted: [value]          ← 12px #475569
    [colored dot] [tier label]  ← 11px, dot color matches circle fill

On mouseLeave from the circle group, clear hoveredNeighborhood.
On SVG mouseLeave, also clear hoveredNeighborhood.

════════════════════════════════════════════════════════════════
FIX 5 — LEGEND
════════════════════════════════════════════════════════════════

Add a legend BELOW the SVG (not inside it — in HTML for better styling).
Render it as a flex row of 5 items:

  [●] Very Low   [●] Low   [●] Moderate   [●] High   [●] Very High

Where each ● is a 10px circle in the corresponding color from Fix 2.
Each label: 12px DM Sans #475569.
The whole legend: display flex, gap 1.25rem, justify-content center, 
margin-top 0.75rem, flex-wrap wrap.

Also add a single line above the legend:
  "Circle size = relative crime volume · Color = intensity tier"
  Font: 11px #94a3b8, text-align center, margin-bottom 0.4rem.

════════════════════════════════════════════════════════════════
FIX 6 — PROMINENT MONTH DISPLAY
════════════════════════════════════════════════════════════════

The current month label is shown in a small <span> next to the slider.
Replace with a styled month badge ABOVE the SVG:

  <div className="map-month-badge">
    <span className="map-month-label">Viewing</span>
    <span className="map-month-value">{selectedMapMonth formatted as "March 2025"}</span>
    <span className="map-month-count">{selectedMapRows.length} neighborhoods</span>
  </div>

CSS:
  .map-month-badge: display flex, align-items baseline, gap 0.5rem, 
    margin-bottom 0.5rem
  .map-month-label: 11px uppercase #94a3b8 letter-spacing 0.1em
  .map-month-value: font-family Instrument Serif, 22px, color #0f172a, 
    font-weight 400
  .map-month-count: 12px #94a3b8

Keep the scrubber slider below the SVG. Remove the raw date string from next 
to the slider (it's now shown in the badge above). Update the slider's 
aria-valuetext to use the formatted month string.

════════════════════════════════════════════════════════════════
FIX 7 — MAP CONTROLS LAYOUT
════════════════════════════════════════════════════════════════

Rearrange the Spatial Map section layout to:

  [Map Year selector]  [▶ Play Timelapse / ⏸ Pause] 
  ───────────────────────────────────────────────
  [Month badge — "Viewing March 2025 · 17 neighborhoods"]
  [SVG map — full width of panel]
  [Scrubber slider — full width]
  [Legend row]

The map controls row (year + play button) should be:
  display flex, gap 1rem, align-items center, margin-bottom 1rem.

Play/Pause button when PLAYING:
  background: #fef3c7, border: 1px solid #fbbf24, color: #92400e
  (amber — signals active state clearly)
  text: "⏸ Pause"
When PAUSED:
  background: white, border: 1px solid #e2e8f0, color: #0f172a
  text: "▶ Play Timelapse"

════════════════════════════════════════════════════════════════
EMPTY STATE AND NO-DATA HANDLING
════════════════════════════════════════════════════════════════

If monthRows is empty or mapMonths is empty:
  Show a centered illustration-free empty state:
    Icon: 🗺️ (2rem)
    Heading: "No map data available" (15px 600-weight)
    Body: "Select a year and click Play to start the timelapse, or drag 
           the scrubber to explore a specific month." (13px #94a3b8)
  Style: centered in a white card, padding 3rem, same card styling as rest of app.

If a neighborhood in monthRows has no position in neighborhoodMapPositions, 
skip it silently (it already does this, just verify the guard is still there).

════════════════════════════════════════════════════════════════
DO NOT CHANGE
════════════════════════════════════════════════════════════════

- mapYear state and selector
- mapMonths, mapRows, mapMonthIndex state
- isMapPlaying state and the setInterval timelapse logic
- The map data fetching effect
- selectedMapMonth and selectedMapRows computation
- All other tabs (Analytics, Forecast, Home, Present)
- Presentation.jsx, PresentationScroll.jsx, and their CSS files

After changes: run npm run build. It must succeed with no errors.

---

**Cursor**

I’m applying a focused rewrite of the `HotspotMap` rendering + map tab layout only (no fetch/state logic changes), then I’ll update just related CSS classes and run a production build to verify.

Implemented exactly what you asked: I read `frontend/src/App.jsx` and `frontend/src/App.css` first, then rewrote only the **HotspotMap rendering** and **Spatial Map visual section** plus related CSS classes — no data-fetching/state/timelapse logic was changed.

### What changed

- Rebuilt hotspot map visuals with:
  - `viewBox="0 0 700 520"`
  - responsive SVG (`width="100%"`, `height="auto"`, `preserveAspectRatio="xMidYMid meet"`, max height 480)
  - new scaled neighborhood positions you provided
  - padded background rect (`x=8`, `y=8`, `width=684`, `height=504`, `rx=12`, `#f8f9fc`/`#e2e8f0`)
- Added `getColorForIntensity(intensity)` with your 5-band color ramp.
- Switched radius to sqrt scaling:
  - `minR=14`, `maxR=46`
  - `minR + Math.sqrt(intensity) * (maxR - minR)`
- Added smooth SVG transitions on circles (`r`, `fill`, `stroke`, `fill-opacity`).
- Removed always-on neighborhood names from circles.
- Kept neighborhood number inside circles (only when `radius >= 20`, with requested text style).
- Added hover tooltip overlay near hovered circle (`div` overlay in map wrapper).
- Added legend below SVG:
  - note line: “Circle size = relative crime volume · Color = intensity tier”
  - 5-tier color legend row
- Added prominent month badge above map:
  - “Viewing [Month Year] [N neighborhoods]”
- Kept scrubber below map and removed raw month text beside slider.
- Updated play/pause button text and visual state:
  - paused: `▶ Play Timelapse`
  - playing: `⏸ Pause` with amber styling
- Added map empty state card (`🗺️`, heading/body) for no-data cases.

### Confirmed unchanged
- `mapYear`, `mapMonths`, `mapRows`, `mapMonthIndex`, `isMapPlaying`, interval logic, map fetch effect, and all other tabs/components were left intact.

### Build verification
- Ran `npm run build` in `frontend` successfully (0 errors).

---

**User**

Read the HotspotMap component in App.jsx and its CSS.
Fix ONLY the HotspotMap component and related CSS. Do not change anything else.

════════════════════════════════════════════════════════════════
PROBLEM DIAGNOSIS (from the screenshot)
════════════════════════════════════════════════════════════════

1. All 17 circles are bunched in the center-right — the left half of the SVG 
   is completely empty. The scaled positions are still too clustered.

2. Circles are too large (maxR=46) — they overlap heavily, making numbers 
   and colors blend together.

3. No names visible — only small numbers that are hard to read, especially 
   on overlapping circles.

════════════════════════════════════════════════════════════════
FIX 1 — REPLACE ALL POSITIONS WITH BETTER-SPREAD ONES
════════════════════════════════════════════════════════════════

Replace neighborhoodMapPositions entirely with these new values.
They are redesigned to fill the full 700×520 SVG space with
roughly the correct geographic relationships for St. Paul:

const neighborhoodMapPositions = {
  1:  { x: 120, y: 430 },   // Southwest
  2:  { x: 290, y: 430 },   // South-central
  3:  { x: 75,  y: 290 },   // West Side
  4:  { x: 390, y: 390 },   // Dayton's Bluff / SE
  5:  { x: 540, y: 340 },   // Payne-Phalen / East
  6:  { x: 470, y: 220 },   // North End
  7:  { x: 195, y: 185 },   // Thomas-Dale
  8:  { x: 310, y: 195 },   // Summit-University
  9:  { x: 140, y: 360 },   // West Seventh
  10: { x: 295, y: 105 },   // Como (north)
  11: { x: 405, y: 145 },   // Hamline-Midway
  12: { x: 510, y: 145 },   // St. Anthony Park (NE)
  13: { x: 310, y: 275 },   // Merriam Park / Central
  14: { x: 205, y: 310 },   // Summit Hill
  15: { x: 390, y: 290 },   // Cathedral Hill area
  16: { x: 155, y: 255 },   // Highland
  17: { x: 625, y: 265 },   // Far East Side
}

════════════════════════════════════════════════════════════════
FIX 2 — SMALLER CIRCLES SO THEY DO NOT OVERLAP
════════════════════════════════════════════════════════════════

Change the radius calculation:
  const minR = 12
  const maxR = 28
  const radius = minR + Math.sqrt(intensity) * (maxR - minR)

This keeps circles readable (12px minimum so numbers fit) but prevents
the heavy overlap seen in the screenshot. 28px maximum is enough to show
size difference without crowding.

════════════════════════════════════════════════════════════════
FIX 3 — SHOW NAME LABELS DIRECTLY ON THE MAP
════════════════════════════════════════════════════════════════

Every neighborhood needs BOTH a number (inside the circle) AND a short name
label directly on the map. Here is exactly how to render each:

STEP A — Short name helper function:
Add this above the component:

  function shortName(fullName) {
    if (!fullName) return ''
    // Strip leading "N - " prefix if present
    const stripped = String(fullName).replace(/^\d+\s*[-–]\s*/, '').trim()
    // Return first word only, max 11 chars
    const first = stripped.split(/[\s/,]/)[0]
    return first.length > 11 ? first.slice(0, 10) + '…' : first
  }

STEP B — Label positioning logic:
For each neighborhood, decide where to place the label based on its
position in the SVG to avoid going off-edge:

  function getLabelOffset(x, y, radius) {
    // Default: label below the circle
    let dx = 0
    let dy = radius + 14
    let anchor = 'middle'

    // If near bottom edge (y > 400), put label above
    if (y > 400) { dy = -(radius + 8); }
    // If near right edge (x > 580), put label to the left
    if (x > 580) { dx = -(radius + 4); dy = 0; anchor = 'end'; }
    // If near left edge (x < 100), put label to the right
    if (x < 100) { dx = radius + 4; dy = 0; anchor = 'start'; }

    return { dx, dy, anchor }
  }

STEP C — Render each neighborhood group like this:

  <g
    key={row.neighborhood_number}
    onMouseEnter={() => setHoveredNeighborhood({ ... })}
    onMouseLeave={() => setHoveredNeighborhood(null)}
    style={{ cursor: 'default' }}
  >
    {/* Main circle */}
    <circle
      cx={pos.x}
      cy={pos.y}
      r={radius}
      fill={colors.fill}
      stroke={colors.stroke}
      strokeWidth={1.5}
      fillOpacity={0.85}
    />

    {/* Neighborhood number inside circle */}
    {radius >= 12 && (
      <text
        x={pos.x}
        y={pos.y}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={Math.min(radius * 0.55, 13)}
        fontWeight="700"
        fill="#1e293b"
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        {row.neighborhood_number}
      </text>
    )}

    {/* Name label outside the circle */}
    {(() => {
      const { dx, dy, anchor } = getLabelOffset(pos.x, pos.y, radius)
      const lx = pos.x + dx
      const ly = pos.y + dy
      const name = shortName(row.neighborhood_name)
      const charWidth = 6.5
      const labelW = name.length * charWidth + 10
      const labelH = 16

      return (
        <g style={{ pointerEvents: 'none' }}>
          {/* White background pill behind the label */}
          <rect
            x={anchor === 'middle' ? lx - labelW / 2 :
               anchor === 'end'   ? lx - labelW :
               lx}
            y={ly - labelH / 2 - 1}
            width={labelW}
            height={labelH}
            rx={4}
            fill="white"
            fillOpacity={0.88}
            stroke="#e2e8f0"
            strokeWidth={0.5}
          />
          <text
            x={lx}
            y={ly}
            textAnchor={anchor}
            dominantBaseline="central"
            fontSize={11}
            fontWeight="500"
            fill="#334155"
          >
            {name}
          </text>
        </g>
      )
    })()}
  </g>

════════════════════════════════════════════════════════════════
FIX 4 — NUMBER INSIDE CIRCLE: HIGHER CONTRAST
════════════════════════════════════════════════════════════════

The number fill color should always be dark for readability.
Use #1e293b (very dark navy) for all circles regardless of color tier.
Do NOT try to invert to white — dark on pastel/mid colors reads better.

fontSize for the number: Math.min(radius * 0.55, 13)
fontWeight: "700"

════════════════════════════════════════════════════════════════
FIX 5 — HOVER TOOLTIP SHOWS FULL NAME + STATS
════════════════════════════════════════════════════════════════

Keep the existing hover tooltip (the <div> overlay approach).
Update the tooltip content to show:
  Line 1: Full neighborhood name (stripped of number prefix) — 13px 600-weight
  Line 2: "Actual crimes: [value]" — 12px
  Line 3: "Predicted: [value]" — 12px
  Line 4: Colored dot + tier label (Very Low / Low / Moderate / High / Very High)

The tooltip should appear near the cursor. Use the hoveredNeighborhood 
state that already exists (add x and y in SVG coordinates to it, convert 
to percentage of SVG width/height for the overlay positioning).

════════════════════════════════════════════════════════════════
FIX 6 — SVG BACKGROUND SUBTLE GRID FOR CONTEXT
════════════════════════════════════════════════════════════════

Inside the SVG, add a very subtle directional label to give geographic 
context — just two text elements, no lines:

  <text x="50" y="490" fontSize="9" fill="#cbd5e1" textAnchor="middle">W</text>
  <text x="650" y="490" fontSize="9" fill="#cbd5e1" textAnchor="end">E</text>
  <text x="660" y="60" fontSize="9" fill="#cbd5e1" textAnchor="end">N</text>
  <text x="660" y="490" fontSize="9" fill="#cbd5e1" textAnchor="end">S</text>

Also add a faint note inside the SVG background:
  <text x="350" y="488" fontSize="8.5" fill="#e2e8f0" textAnchor="middle"
        fontStyle="italic">
    Approximate geographic positions · St. Paul, MN
  </text>

════════════════════════════════════════════════════════════════
DO NOT CHANGE
════════════════════════════════════════════════════════════════

- Play/pause timelapse logic and interval
- Month scrubber slider
- mapYear selector
- All data fetching
- Color scale (the 5 tier colors are good — keep them)
- Legend below SVG
- Month badge above SVG
- All other tabs and components
- After changes run npm run build — must succeed

---

**Cursor**

I’ll now apply your exact hotspot-only refinements: replace positions, shrink radius scale, add on-map short-name pills with edge-aware offsets, keep dark high-contrast numbers, improve tooltip content/positioning, and add the subtle directional SVG context text. Then I’ll run a build.

Done — I changed only the HotspotMap rendering path and related map CSS behavior, keeping all data/state/timelapse logic untouched.

### Applied fixes

- Replaced `neighborhoodMapPositions` with your new spread-out 700×520 coordinates.
- Reduced radius scaling to avoid crowding:
  - `minR = 12`, `maxR = 28`
  - `radius = minR + Math.sqrt(intensity) * (maxR - minR)`
- Added name labels directly on-map for every neighborhood:
  - short-name helper `shortName(...)`
  - edge-aware placement helper `getLabelOffset(...)`
  - white label pill background with subtle border
- Kept high-contrast numbers inside circles:
  - always dark `#1e293b`
  - `fontSize={Math.min(radius * 0.55, 13)}`
  - `fontWeight="700"`
- Updated hover tooltip content/position:
  - full name (prefix stripped)
  - `Actual crimes: ...`
  - `Predicted: ...`
  - tier chip with matching color
  - positioned near cursor using percentage-based overlay placement
- Added subtle geographic context text inside SVG:
  - W/E/N/S markers
  - “Approximate geographic positions · St. Paul, MN”
- Kept legend and month badge behavior intact (as requested).

### Verification

- Ran `npm run build` in `frontend` — **success, no errors**.

---

**User**

this is what the graphs look like, maybe remove the numbers and actually also map it to the map of saint paul an dthe neighborhood it is refereing to, have the map of st paul in the background in very light color and make it look better all in all

---

**Cursor**

Makes sense — I’ll remove the numeric markers, improve the labels, and add a very light “St. Paul” map-style backdrop so the bubbles feel geographically anchored and cleaner overall. I’ll only adjust the hotspot rendering/CSS.

Done — I made the hotspot map cleaner and closer to what you described:

### What I changed
- Removed the numeric markers inside circles.
- Kept labels on-map and improved their readability (slightly larger, bolder text).
- Added a very light Saint Paul–style backdrop shape behind the data:
  - subtle city silhouette
  - faint river-like guide lines
  - low opacity so circles remain the focus
- Kept tooltip behavior and all existing map interactions (play/pause, scrubber, year selector, data/state logic).

### Files changed
- `frontend/src/App.jsx` (HotspotMap visual rendering only)
- `frontend/src/App.css` (related hotspot/map styling only)

### Verification
- `npm run build` succeeds with no errors.

If you want, next pass I can make the backdrop more geographically faithful by tracing a cleaner district-like shape from your neighborhood point cloud (still lightweight and subtle).

