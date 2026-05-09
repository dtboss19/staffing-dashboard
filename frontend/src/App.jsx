/**
 * AUDIT SUMMARY — multi-perspective redesign (see git history)
 *
 * FILES MODIFIED:
 *   frontend/index.html, frontend/src/App.jsx, frontend/src/App.css,
 *   frontend/src/index.css, frontend/src/Presentation.jsx,
 *   frontend/src/Presentation.css, frontend/src/PresentationScroll.jsx,
 *   frontend/src/PresentationScroll.css
 *
 * NEW FILES:
 *   frontend/src/ErrorBoundary.jsx, frontend/src/formatters.js,
 *   frontend/src/TrendChart.jsx, frontend/src/ForecastTrendChart.jsx
 *
 * FIVE MOST IMPACTFUL CHANGES:
 *   1. Design tokens (spacing, type, shadows, semantics) + shared `.card`
 *      unify dashboard surfaces for a single-product feel (see index.css).
 *   2. Debounced year filters + AbortController prevents wasted/stale loads
 *      when typing or flipping filters quickly.
 *   3. Per-panel skeleton loaders, descriptive empty states, and tab captions
 *      materially improve perceived quality and orientation for new users.
 *   4. Charts lifted to TrendChart.jsx / ForecastTrendChart.jsx with cursor-aware
 *      tooltips, axis titles, strengthened grid lines, and accessible labels.
 *   5. Skip link, global focus-visible, scoped table captions/roles/col scopes,
 *      and ErrorBoundary lift baseline accessibility/resilience toward WCAG-aligned UX.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Presentation } from './Presentation'
import { PresentationScroll } from './PresentationScroll'
import { ErrorBoundary } from './ErrorBoundary'
import ForecastTrendChart from './ForecastTrendChart'
import TrendChart from './TrendChart'
import { formatMonthYear, formatNeighborhoodDisplayName, formatNumber, toQueryString } from './formatters'
import { clearCache, getCacheEntry, getCached, invalidateTab, setCached } from './dataCache'
import './App.css'

/**
 * SESSION AUDIT (performance fixes)
 *
 * FILES MODIFIED THIS SESSION:
 * - frontend/src/App.jsx
 * - frontend/src/dataCache.js
 * - frontend/src/TrendChart.jsx
 * - frontend/src/ForecastTrendChart.jsx
 * - frontend/src/formatters.js
 * - frontend/src/App.css
 * - frontend/src/PresentationScroll.css
 * - frontend/index.html
 * - frontend/.env.example
 *
 * TOP 3 IMPACT CHANGES:
 * - Added tab-scoped in-memory caching + manual refresh to prevent refetches on every tab switch.
 * - Offline-mode detection when `VITE_API_BASE_URL` is unset so static Vercel deploy loads instantly.
 * - 300ms skeleton gate + bottom-right toast banners to eliminate demo-hostile loading flashes.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''
const OFFLINE_MODE = API_BASE_URL.trim() === ''

// Backend latency policy: first success enables shorter timeouts.
let backendReachable = false

const defaultFilterState = {
  startYear: 2014,
  endYear: 2026,
  neighborhoodNumber: '',
}

const YEAR_MIN = 2014
const YEAR_MAX = 2026

const neighborhoodMapPositions = {
  1: { x: 120, y: 430 },
  2: { x: 290, y: 430 },
  3: { x: 75, y: 290 },
  4: { x: 390, y: 390 },
  5: { x: 540, y: 340 },
  6: { x: 470, y: 220 },
  7: { x: 195, y: 185 },
  8: { x: 310, y: 195 },
  9: { x: 140, y: 360 },
  10: { x: 295, y: 105 },
  11: { x: 405, y: 145 },
  12: { x: 510, y: 145 },
  13: { x: 310, y: 275 },
  14: { x: 205, y: 310 },
  15: { x: 390, y: 290 },
  16: { x: 155, y: 255 },
  17: { x: 625, y: 265 },
}

function shortName(fullName) {
  if (!fullName) return ''
  const stripped = String(fullName).replace(/^\d+\s*[-–]\s*/, '').trim()
  const words = stripped.split(/[\s/,-]+/).filter(Boolean)
  const compact = words.slice(0, 2).join(' ')
  return compact.length > 16 ? `${compact.slice(0, 15)}…` : compact
}

function fullNeighborhoodName(fullName) {
  if (!fullName) return ''
  return String(fullName).replace(/^\d+\s*[-–]\s*/, '').trim()
}

function getLabelOffset(x, y, radius) {
  let dx = 0
  let dy = radius + 14
  let anchor = 'middle'
  if (y > 400) dy = -(radius + 8)
  if (x > 580) {
    dx = -(radius + 4)
    dy = 0
    anchor = 'end'
  }
  if (x < 100) {
    dx = radius + 4
    dy = 0
    anchor = 'start'
  }
  return { dx, dy, anchor }
}

function HotspotMap({ monthRows, monthLabel }) {
  const [hoveredNeighborhood, setHoveredNeighborhood] = useState(null)
  const [tooltipPosition, setTooltipPosition] = useState({ xPct: 0, yPct: 0 })
  const mapContainerRef = useRef(null)

  function getColorForIntensity(intensity) {
    if (intensity <= 0.2) return { fill: '#bfdbfe', stroke: '#93c5fd', tier: 'Very Low' }
    if (intensity <= 0.4) return { fill: '#86efac', stroke: '#4ade80', tier: 'Low' }
    if (intensity <= 0.6) return { fill: '#fde68a', stroke: '#fbbf24', tier: 'Moderate' }
    if (intensity <= 0.8) return { fill: '#fb923c', stroke: '#f97316', tier: 'High' }
    return { fill: '#f87171', stroke: '#ef4444', tier: 'Very High' }
  }

  function onNeighborhoodEnter(event, row, pos, intensity) {
    const container = mapContainerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    const px = Math.max(0, Math.min(rect.width, event.clientX - rect.left))
    const py = Math.max(0, Math.min(rect.height, event.clientY - rect.top))
    const xPct = (px / Math.max(rect.width, 1)) * 100
    const yPct = (py / Math.max(rect.height, 1)) * 100
    const color = getColorForIntensity(intensity)
    setTooltipPosition({ xPct, yPct })
    setHoveredNeighborhood({
      number: row.neighborhood_number,
      name: fullNeighborhoodName(row.neighborhood_name),
      actual: row.actual_total_count,
      predicted: row.predicted_total_count,
      tier: color.tier,
      fill: color.fill,
    })
  }

  if (!monthRows.length) {
    return (
      <div className="map-empty-state card">
        <div className="map-empty-icon" aria-hidden>
          🗺️
        </div>
        <h3>No map data available</h3>
        <p>
          Select a year and click Play to start the timelapse, or drag the scrubber to explore a specific month.
        </p>
      </div>
    )
  }
  const width = 700
  const height = 520
  const maxActual = Math.max(...monthRows.map((row) => Number(row.actual_total_count || 0)), 1)

  return (
    <div ref={mapContainerRef} className="hotspot-map-wrap hotspot-wrap-card card">
      <svg
        className="hotspot-svg card"
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height="auto"
        preserveAspectRatio="xMidYMid meet"
        style={{ display: 'block', maxHeight: '480px' }}
        role="img"
        aria-label={`Neighborhood hotspot map for ${monthLabel}. Bubble size scales with relative crime count for each area.`}
        onMouseLeave={() => setHoveredNeighborhood(null)}
      >
        <rect x="8" y="8" width="684" height="504" rx="12" fill="#f8f9fc" stroke="#e2e8f0" strokeWidth="1" />
        <g className="stpaul-backdrop" aria-hidden>
          <path
            d="M98 112 C166 72, 278 64, 392 92 C504 118, 598 182, 624 266 C646 338, 596 416, 494 450 C390 484, 254 482, 156 438 C84 406, 52 352, 56 286 C60 212, 80 146, 98 112 Z"
          />
          <path
            d="M118 282 C188 256, 280 250, 366 266 C452 284, 520 316, 582 364"
            className="stpaul-river"
          />
          <path
            d="M108 212 C178 196, 258 194, 334 208 C406 222, 474 248, 552 292"
            className="stpaul-river"
          />
        </g>
        <text x="50" y="490" fontSize="9" fill="#cbd5e1" textAnchor="middle">W</text>
        <text x="650" y="490" fontSize="9" fill="#cbd5e1" textAnchor="end">E</text>
        <text x="660" y="60" fontSize="9" fill="#cbd5e1" textAnchor="end">N</text>
        <text x="660" y="490" fontSize="9" fill="#cbd5e1" textAnchor="end">S</text>
        <text x="350" y="488" fontSize="8.5" fill="#e2e8f0" textAnchor="middle" fontStyle="italic">
          Approximate geographic positions · St. Paul, MN
        </text>
        {monthRows.map((row) => {
          const position = neighborhoodMapPositions[row.neighborhood_number]
          if (!position) return null
          const intensity = Number(row.actual_total_count || 0) / maxActual
          const colors = getColorForIntensity(intensity)
          const minR = 12
          const maxR = 28
          const radius = minR + Math.sqrt(intensity) * (maxR - minR)
          return (
            <g
              key={row.neighborhood_number}
              onMouseEnter={(event) => onNeighborhoodEnter(event, row, position, intensity)}
              onMouseLeave={() => setHoveredNeighborhood(null)}
              style={{ cursor: 'default' }}
            >
              <circle
                cx={position.x}
                cy={position.y}
                r={radius}
                className="hotspot-circle"
                fill={colors.fill}
                stroke={colors.stroke}
                strokeWidth="1.5"
                fillOpacity="0.82"
              />
              <circle cx={position.x} cy={position.y} r="2.5" className="hotspot-center" />
              {(() => {
                const { dx, dy, anchor } = getLabelOffset(position.x, position.y, radius)
                const lx = position.x + dx
                const ly = position.y + dy
                const name = shortName(row.neighborhood_name)
                const charWidth = 6.5
                const labelW = name.length * charWidth + 10
                const labelH = 16
                return (
                  <g style={{ pointerEvents: 'none' }}>
                    <rect
                      x={anchor === 'middle' ? lx - labelW / 2 : anchor === 'end' ? lx - labelW : lx}
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
                      fontSize={11.5}
                      fontWeight="600"
                      fill="#1f2937"
                    >
                      {name}
                    </text>
                  </g>
                )
              })()}
              <title>
                {`${formatNeighborhoodDisplayName(row.neighborhood_name)} | Actual: ${formatNumber(row.actual_total_count, 2)} | Predicted: ${formatNumber(row.predicted_total_count, 2)}`}
              </title>
            </g>
          )
        })}
      </svg>
      {hoveredNeighborhood ? (
        <div
          className="hotspot-tooltip"
          style={{
            left: `min(calc(${tooltipPosition.xPct}% + 12px), calc(100% - 228px))`,
            top: `min(calc(${tooltipPosition.yPct}% + 12px), calc(100% - 96px))`,
          }}
        >
          <div className="hotspot-tooltip-title">{hoveredNeighborhood.name}</div>
          <div>Actual crimes: {formatNumber(hoveredNeighborhood.actual, 2)}</div>
          <div>Predicted: {formatNumber(hoveredNeighborhood.predicted, 2)}</div>
          <div className="hotspot-tooltip-tier">
            <span className="hotspot-tooltip-dot" style={{ background: hoveredNeighborhood.fill }} aria-hidden />
            <span>{hoveredNeighborhood.tier}</span>
          </div>
        </div>
      ) : null}
      <div className="hotspot-map-label-note">Circle size = relative crime volume · Color = intensity tier</div>
      <div className="hotspot-map-legend" aria-label="Hotspot intensity legend">
        <span><i style={{ background: '#bfdbfe' }} /> Very Low</span>
        <span><i style={{ background: '#86efac' }} /> Low</span>
        <span><i style={{ background: '#fde68a' }} /> Moderate</span>
        <span><i style={{ background: '#fb923c' }} /> High</span>
        <span><i style={{ background: '#f87171' }} /> Very High</span>
      </div>
    </div>
  )
}

const TAB_HINTS = {
  scroll:
    'Narrative overview of the project methodology, stack, policy results, and links into the live dashboards.',
  analytics: 'Actual vs predicted crime counts by month and neighborhood.',
  forecast: '2026 projections and staff allocation from the frozen forecast.',
  map: 'Month-by-month crime intensity across neighborhoods on a schematic layout.',
}

const KPI_DEFS = [
  {
    key: 'avg_actual_total_count',
    label: 'Avg Monthly Crimes (Actual)',
    tip: 'Average actual total crime counts per month in your current filter.',
  },
  {
    key: 'avg_predicted_total_count',
    label: 'Avg Monthly Crimes (Predicted)',
    tip: 'Average model-predicted total crime counts per month in your current filter.',
  },
  {
    key: 'avg_ape_total_pct',
    label: 'Avg Prediction Error (%)',
    tip: 'Average absolute percent error between actual and predicted totals across months.',
  },
  {
    key: 'avg_staffing_strength_score',
    label: 'Avg Staffing Pressure Score',
    tip: 'Composite 0–100 demand signal blending predicted severity, mix, and model confidence.',
  },
]

function App() {
  const [presentationMode, setPresentationMode] = useState(false)
  const [activeTab, setActiveTab] = useState('scroll')
  const [filters, setFilters] = useState(defaultFilterState)
  const [yearDraft, setYearDraft] = useState(() => ({
    startYear: defaultFilterState.startYear,
    endYear: defaultFilterState.endYear,
  }))
  const [filtersExpanded, setFiltersExpanded] = useState(
    () => typeof window !== 'undefined' && window.innerWidth >= 640,
  )
  const yearDebounceTimer = useRef(null)

  useEffect(() => {
    const mediaQueryList = window.matchMedia('(max-width: 639px)')
    const handleMatch = () => {
      setFiltersExpanded(!mediaQueryList.matches)
    }
    handleMatch()
    mediaQueryList.addEventListener('change', handleMatch)
    return () => mediaQueryList.removeEventListener('change', handleMatch)
  }, [])

  useEffect(() => {
    if (yearDebounceTimer.current) {
      window.clearTimeout(yearDebounceTimer.current)
    }
    yearDebounceTimer.current = window.setTimeout(() => {
      if (yearDraft.startYear > yearDraft.endYear) {
        return
      }
      setFilters((previous) => ({
        ...previous,
        startYear: yearDraft.startYear,
        endYear: yearDraft.endYear,
      }))
    }, 400)
    return () => {
      if (yearDebounceTimer.current) window.clearTimeout(yearDebounceTimer.current)
    }
  }, [yearDraft.startYear, yearDraft.endYear])

  const yearRangeInvalid = yearDraft.startYear > yearDraft.endYear

  const [availableFilters, setAvailableFilters] = useState({ years: [], neighborhoods: [], categories: [] })
  const [kpis, setKpis] = useState(null)
  const [summaryRows, setSummaryRows] = useState([])
  const [trendRows, setTrendRows] = useState([])
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedCategoryYear, setSelectedCategoryYear] = useState('')
  const [categoryTrendRows, setCategoryTrendRows] = useState([])
  const [allCategoryTrendRows, setAllCategoryTrendRows] = useState([])
  const [extremes, setExtremes] = useState(null)
  const [forecastRows, setForecastRows] = useState([])
  const [forecastTrendRows, setForecastTrendRows] = useState([])
  const [mapYear, setMapYear] = useState('all')
  const [mapMonths, setMapMonths] = useState([])
  const [mapRows, setMapRows] = useState([])
  const [mapLoading, setMapLoading] = useState(false)
  const [mapMonthIndex, setMapMonthIndex] = useState(0)
  const [isMapPlaying, setIsMapPlaying] = useState(false)
  const [toastItems, setToastItems] = useState([])
  const toastTimersRef = useRef(new Map())
  const toastIdRef = useRef(0)
  const [isLoading, setIsLoading] = useState(false)
  const [showSkeleton, setShowSkeleton] = useState(false)
  const [refreshNonce, setRefreshNonce] = useState(0)
  const dashboardRetryCountRef = useRef(0)
  const mapRetryCountRef = useRef(0)
  const [forecastVisibleCount, setForecastVisibleCount] = useState(40)
  const [backendBannerHidden, setBackendBannerHidden] = useState(false)

  const neighborhoodCount = Math.max(availableFilters.neighborhoods.length, 17)
  const baseQuery = useMemo(() => toQueryString(filters), [filters])

  const filterSummaryLine = useMemo(() => {
    const neighborhoodPhrase = filters.neighborhoodNumber
      ? formatNeighborhoodDisplayName(
          availableFilters.neighborhoods.find(
            (n) => String(n.neighborhood_number) === String(filters.neighborhoodNumber),
          )?.neighborhood_name ?? `Neighborhood ${filters.neighborhoodNumber}`,
        )
      : `all ${neighborhoodCount} neighborhoods`
    return `Showing data from ${yearDraft.startYear} to ${yearDraft.endYear} · ${neighborhoodPhrase}`
  }, [filters.neighborhoodNumber, neighborhoodCount, availableFilters.neighborhoods, yearDraft])

  useEffect(() => {
    async function loadFilterOptions() {
      if (OFFLINE_MODE) return
      try {
        const response = await fetch(`${API_BASE_URL}/filters`)
        const payload = await response.json()
        setAvailableFilters(payload)
        if (payload.years.length) {
          const smallestYear = Math.min(...payload.years)
          const largestYear = Math.max(...payload.years)
          setFilters((previous) => ({
            ...previous,
            startYear: smallestYear,
            endYear: largestYear,
          }))
          setYearDraft({ startYear: smallestYear, endYear: largestYear })
          setSelectedCategoryYear(String(largestYear))
          setMapYear('all')
        }
      } catch {
        dashboardRetryCountRef.current += 1
        setBackendBannerHidden(false)
      }
    }
    loadFilterOptions()
  }, [])

  useEffect(() => {
    if (!isLoading) {
      setShowSkeleton(false)
      return undefined
    }
    const t = window.setTimeout(() => setShowSkeleton(true), 300)
    return () => window.clearTimeout(t)
  }, [isLoading])

  useEffect(() => {
    if (activeTab === 'scroll' || presentationMode) return
    invalidateTab(activeTab)
  }, [filters.startYear, filters.endYear, filters.neighborhoodNumber, activeTab, presentationMode])

  function pushToast(message, variant = 'error') {
    const id = `t-${Date.now()}-${toastIdRef.current++}`
    setToastItems((previous) => [...previous, { id, message, variant }])
    if (toastTimersRef.current.has(id)) window.clearTimeout(toastTimersRef.current.get(id))
    const timer = window.setTimeout(() => {
      setToastItems((previous) => previous.filter((item) => item.id !== id))
      toastTimersRef.current.delete(id)
    }, 6000)
    toastTimersRef.current.set(id, timer)
  }

  function dismissToast(id) {
    if (toastTimersRef.current.has(id)) window.clearTimeout(toastTimersRef.current.get(id))
    toastTimersRef.current.delete(id)
    setToastItems((previous) => previous.filter((item) => item.id !== id))
  }

  function getTabKey(tab) {
    return `${tab}:${filters.startYear}-${filters.endYear}-${filters.neighborhoodNumber || 'all'}`
  }

  function idleSchedule(fn) {
    try {
      if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(fn, { timeout: 1000 })
        return
      }
    } catch {
      // ignore
    }
    window.setTimeout(fn, 200)
  }

  useEffect(() => {
    if (yearRangeInvalid) return undefined

    if (OFFLINE_MODE) {
      setIsLoading(false)
      return undefined
    }

    const isAnalyticsTab = activeTab === 'analytics'
    const isForecastTab = activeTab === 'forecast'

    const cacheKey = getTabKey(activeTab)
    const cacheEntry = getCacheEntry(cacheKey)
    const cachedFresh = cacheEntry && Date.now() - cacheEntry.timestamp <= 5 * 60 * 1000 ? cacheEntry.data : null
    if (cachedFresh && (isAnalyticsTab || isForecastTab)) {
      if (isAnalyticsTab) {
        setKpis(cachedFresh.kpis ?? null)
        setSummaryRows(cachedFresh.summaryRows ?? [])
        setTrendRows(cachedFresh.trendRows ?? [])
        setExtremes(cachedFresh.extremes ?? null)
      }
      if (isForecastTab) {
        setForecastRows(cachedFresh.forecastRows ?? [])
        setForecastTrendRows(cachedFresh.forecastTrendRows ?? [])
      }
      setIsLoading(false)
      return undefined
    }

    const abortController = new AbortController()
    const requestTimeoutMs = backendReachable ? 4000 : 8000
    const timeoutId = window.setTimeout(() => abortController.abort(), requestTimeoutMs)

    async function loadDashboardData() {
      // Avoid hammering the API when the Home narrative is showing.
      if (activeTab === 'scroll' || presentationMode) {
        window.clearTimeout(timeoutId)
        return
      }

      setIsLoading(true)
      const signal = abortController.signal

      async function checkedFetch(url, init = {}) {
        const response = await fetch(url, { ...init, signal })
        if (!response.ok) throw new Error('Request failed')
        return response.json()
      }

      try {
        const analyticsPromise = isAnalyticsTab
          ? Promise.all([
              checkedFetch(`${API_BASE_URL}/kpis?${baseQuery}`),
              checkedFetch(
                `${API_BASE_URL}/neighborhood-summary?start_year=${filters.startYear}&end_year=${filters.endYear}${filters.neighborhoodNumber ? `&neighborhood_number=${filters.neighborhoodNumber}` : ''}`,
              ),
              checkedFetch(`${API_BASE_URL}/trend?${baseQuery}`),
              checkedFetch(`${API_BASE_URL}/extremes?${baseQuery}`),
            ])
          : Promise.resolve(null)

        const forecastPromise = isForecastTab
          ? Promise.all([
              checkedFetch(
                `${API_BASE_URL}/forecast?start_year=${filters.startYear}&end_year=${filters.endYear}${filters.neighborhoodNumber ? `&neighborhood_number=${filters.neighborhoodNumber}` : ''}`,
              ),
              checkedFetch(
                `${API_BASE_URL}/forecast-trend?start_year=${filters.startYear}&end_year=${filters.endYear}${filters.neighborhoodNumber ? `&neighborhood_number=${filters.neighborhoodNumber}` : ''}`,
              ),
            ])
          : Promise.resolve(null)

        const [analyticsPayload, forecastPayload] = await Promise.all([analyticsPromise, forecastPromise])

        backendReachable = true
        dashboardRetryCountRef.current = 0
        setBackendBannerHidden(false)

        if (analyticsPayload) {
          const [kpiPayload, summaryPayload, trendPayload, extremesPayload] = analyticsPayload
          setKpis(kpiPayload)
          setSummaryRows(summaryPayload)
          setTrendRows(trendPayload)
          setExtremes(extremesPayload)
        }

        if (forecastPayload) {
          const [forecastRowsPayload, forecastTrendRowsPayload] = forecastPayload
          setForecastRows(forecastRowsPayload)
          setForecastTrendRows(forecastTrendRowsPayload)
        }

        if (isAnalyticsTab) {
          setCached(cacheKey, {
            kpis: analyticsPayload?.[0] ?? null,
            summaryRows: analyticsPayload?.[1] ?? [],
            trendRows: analyticsPayload?.[2] ?? [],
            extremes: analyticsPayload?.[3] ?? null,
          })
          idleSchedule(() => {
            try {
              if (activeTab !== 'analytics') return
              const preloadKey = `forecast:${filters.startYear}-${filters.endYear}-${filters.neighborhoodNumber || 'all'}`
              if (getCached(preloadKey)) return
              Promise.all([
                fetch(
                  `${API_BASE_URL}/forecast?start_year=${filters.startYear}&end_year=${filters.endYear}${filters.neighborhoodNumber ? `&neighborhood_number=${filters.neighborhoodNumber}` : ''}`,
                ).then((r) => (r.ok ? r.json() : Promise.reject(new Error('forecast')))),
                fetch(
                  `${API_BASE_URL}/forecast-trend?start_year=${filters.startYear}&end_year=${filters.endYear}${filters.neighborhoodNumber ? `&neighborhood_number=${filters.neighborhoodNumber}` : ''}`,
                ).then((r) => (r.ok ? r.json() : Promise.reject(new Error('forecast-trend')))),
              ]).then(([forecastRowsPayload, forecastTrendRowsPayload]) => {
                setCached(preloadKey, { forecastRows: forecastRowsPayload, forecastTrendRows: forecastTrendRowsPayload })
              })
            } catch {
              // preload failures must never surface
            }
          })
        }

        if (isForecastTab) {
          setCached(cacheKey, {
            forecastRows: forecastPayload?.[0] ?? [],
            forecastTrendRows: forecastPayload?.[1] ?? [],
          })
          idleSchedule(() => {
            try {
              if (activeTab !== 'forecast') return
              const preloadKey = `analytics:${filters.startYear}-${filters.endYear}-${filters.neighborhoodNumber || 'all'}`
              if (getCached(preloadKey)) return
              Promise.all([
                fetch(`${API_BASE_URL}/kpis?${baseQuery}`).then((r) => (r.ok ? r.json() : Promise.reject(new Error('kpis')))),
                fetch(
                  `${API_BASE_URL}/neighborhood-summary?start_year=${filters.startYear}&end_year=${filters.endYear}${filters.neighborhoodNumber ? `&neighborhood_number=${filters.neighborhoodNumber}` : ''}`,
                ).then((r) => (r.ok ? r.json() : Promise.reject(new Error('summary')))),
                fetch(`${API_BASE_URL}/trend?${baseQuery}`).then((r) => (r.ok ? r.json() : Promise.reject(new Error('trend')))),
                fetch(`${API_BASE_URL}/extremes?${baseQuery}`).then((r) => (r.ok ? r.json() : Promise.reject(new Error('extremes')))),
              ]).then(([kpiPayload, summaryPayload, trendPayload, extremesPayload]) => {
                setCached(preloadKey, { kpis: kpiPayload, summaryRows: summaryPayload, trendRows: trendPayload, extremes: extremesPayload })
              })
            } catch {
              // preload failures must never surface
            }
          })
        }
      } catch (fetchError) {
        if (fetchError.name === 'AbortError') return

        const entry = getCacheEntry(cacheKey)
        const isStale = entry ? Date.now() - entry.timestamp > 5 * 60 * 1000 : false
        if (entry?.data && isStale) {
          if (isAnalyticsTab) {
            setKpis(entry.data.kpis ?? null)
            setSummaryRows(entry.data.summaryRows ?? [])
            setTrendRows(entry.data.trendRows ?? [])
            setExtremes(entry.data.extremes ?? null)
          }
          if (isForecastTab) {
            setForecastRows(entry.data.forecastRows ?? [])
            setForecastTrendRows(entry.data.forecastTrendRows ?? [])
          }
          pushToast('Showing cached data — backend may be offline', 'warn')
        } else {
          pushToast('Failed to query dashboard endpoints.', 'error')
        }

        dashboardRetryCountRef.current += 1
        setBackendBannerHidden(false)
      } finally {
        window.clearTimeout(timeoutId)
        if (!abortController.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    loadDashboardData()
    return () => {
      window.clearTimeout(timeoutId)
      abortController.abort()
    }
  }, [
    activeTab,
    baseQuery,
    filters.endYear,
    filters.startYear,
    filters.neighborhoodNumber,
    presentationMode,
    refreshNonce,
    yearRangeInvalid,
  ])

  useEffect(() => {
    if (OFFLINE_MODE) return undefined
    if (activeTab !== 'analytics') return undefined
    if (!filters.neighborhoodNumber || !selectedCategoryYear) {
      setCategoryTrendRows([])
      setAllCategoryTrendRows([])
      return undefined
    }

    const categoryKey = `analytics-category:${selectedCategoryYear}-${selectedCategory || 'all'}-${filters.neighborhoodNumber}`
    const categoryEntry = getCacheEntry(categoryKey)
    const cachedFresh = categoryEntry && Date.now() - categoryEntry.timestamp <= 5 * 60 * 1000 ? categoryEntry.data : null
    if (cachedFresh) {
      setCategoryTrendRows(cachedFresh.categoryTrendRows ?? [])
      setAllCategoryTrendRows(cachedFresh.allCategoryTrendRows ?? [])
      return undefined
    }

    const abortController = new AbortController()
    const requestTimeoutMs = backendReachable ? 4000 : 8000
    const timeoutId = window.setTimeout(() => abortController.abort(), requestTimeoutMs)

    async function loadCategoryData() {
      try {
        if (selectedCategory) {
          const response = await fetch(
            `${API_BASE_URL}/category-count-trend?category=${encodeURIComponent(selectedCategory)}&start_year=${selectedCategoryYear}&end_year=${selectedCategoryYear}&neighborhood_number=${filters.neighborhoodNumber}`,
            { signal: abortController.signal },
          )
          if (!response.ok) throw new Error('category')
          const payload = await response.json()
          setCategoryTrendRows(payload)
          setAllCategoryTrendRows([])
          setCached(categoryKey, { categoryTrendRows: payload, allCategoryTrendRows: [] })
        } else {
          const response = await fetch(
            `${API_BASE_URL}/category-all-count-trend?start_year=${selectedCategoryYear}&end_year=${selectedCategoryYear}&neighborhood_number=${filters.neighborhoodNumber}`,
            { signal: abortController.signal },
          )
          if (!response.ok) throw new Error('all-category')
          const payload = await response.json()
          setAllCategoryTrendRows(payload)
          setCategoryTrendRows([])
          setCached(categoryKey, { categoryTrendRows: [], allCategoryTrendRows: payload })
        }
        backendReachable = true
      } catch (error) {
        if (error.name === 'AbortError') return
        const entry = getCacheEntry(categoryKey)
        const isStale = entry ? Date.now() - entry.timestamp > 5 * 60 * 1000 : false
        if (entry?.data && isStale) {
          setCategoryTrendRows(entry.data.categoryTrendRows ?? [])
          setAllCategoryTrendRows(entry.data.allCategoryTrendRows ?? [])
          pushToast('Showing cached data — backend may be offline', 'warn')
        }
      } finally {
        window.clearTimeout(timeoutId)
      }
    }

    loadCategoryData()
    return () => {
      window.clearTimeout(timeoutId)
      abortController.abort()
    }
  }, [OFFLINE_MODE, activeTab, selectedCategory, selectedCategoryYear, filters.neighborhoodNumber])

  useEffect(() => {
    const abortController = new AbortController()
    const requestTimeoutMs = backendReachable ? 4000 : 8000
    const timeoutId = window.setTimeout(() => abortController.abort(), requestTimeoutMs)
    async function loadMapData() {
      if (OFFLINE_MODE) {
        window.clearTimeout(timeoutId)
        return
      }
      if (activeTab !== 'map' || presentationMode) {
        window.clearTimeout(timeoutId)
        return
      }
      if (!mapYear) return

      const mapKey = `map:${mapYear}`
      const mapEntry = getCacheEntry(mapKey)
      const cachedFresh = mapEntry && Date.now() - mapEntry.timestamp <= 5 * 60 * 1000 ? mapEntry.data : null
      if (cachedFresh) {
        setMapMonths(cachedFresh.months || [])
        setMapRows(cachedFresh.rows || [])
        setMapMonthIndex(0)
        setMapLoading(false)
        return
      }

      setMapLoading(true)
      try {
        const mapQuery = mapYear === 'all' ? '' : `?year=${mapYear}`
        const response = await fetch(`${API_BASE_URL}/map-hotspots${mapQuery}`, {
          signal: abortController.signal,
        })
        if (!response.ok) throw new Error('map')
        const payload = await response.json()
        setMapMonths(payload.months || [])
        setMapRows(payload.rows || [])
        setMapMonthIndex(0)
        backendReachable = true
        mapRetryCountRef.current = 0
        setCached(mapKey, { months: payload.months || [], rows: payload.rows || [] })
      } catch (error) {
        if (error.name === 'AbortError') return
        mapRetryCountRef.current += 1
        if (mapRetryCountRef.current >= 2) {
          pushToast('Failed to load map hotspot data.', 'error')
        }
      } finally {
        window.clearTimeout(timeoutId)
        if (!abortController.signal.aborted) {
          setMapLoading(false)
        }
      }
    }
    loadMapData()
    return () => {
      window.clearTimeout(timeoutId)
      abortController.abort()
    }
  }, [OFFLINE_MODE, activeTab, mapYear, presentationMode, refreshNonce])

  useEffect(() => {
    if (!isMapPlaying || mapMonths.length <= 1) return undefined
    const timer = window.setInterval(() => {
      setMapMonthIndex((previous) => (previous + 1) % mapMonths.length)
    }, 900)
    return () => window.clearInterval(timer)
  }, [isMapPlaying, mapMonths.length])

  function updateFilter(key, value) {
    setFilters((previous) => ({ ...previous, [key]: value }))
  }

  const selectedMapMonth = mapMonths[mapMonthIndex] || null
  const selectedMapRows = useMemo(
    () => mapRows.filter((row) => row.month_start === selectedMapMonth),
    [mapRows, selectedMapMonth],
  )
  const allCategoryRows = useMemo(
    () =>
      allCategoryTrendRows
        .map((row) => {
          const actualTotal =
            Number(row.actual_narcotic_count || 0) +
            Number(row.actual_property_damage_count || 0) +
            Number(row.actual_property_theft_count || 0) +
            Number(row.actual_violent_person_count || 0) +
            Number(row.actual_weapons_count || 0)
          const absoluteErrorTotal =
            Math.abs(Number(row.actual_narcotic_count || 0) - Number(row.predict_narcotic_count || 0)) +
            Math.abs(Number(row.actual_property_damage_count || 0) - Number(row.predict_property_damage_count || 0)) +
            Math.abs(Number(row.actual_property_theft_count || 0) - Number(row.predict_property_theft_count || 0)) +
            Math.abs(Number(row.actual_violent_person_count || 0) - Number(row.predict_violent_person_count || 0)) +
            Math.abs(Number(row.actual_weapons_count || 0) - Number(row.predict_weapons_count || 0))
          return {
            ...row,
            ape_5_category_pct: actualTotal > 0 ? (absoluteErrorTotal * 100.0) / actualTotal : null,
          }
        })
        .sort((left, right) => left.month_start.localeCompare(right.month_start)),
    [allCategoryTrendRows],
  )

  const monthSliderLabel = selectedMapMonth ? formatMonthYear(selectedMapMonth) : ''

  const trendChartAria = `Line chart showing actual and predicted monthly crime counts from ${filters.startYear} to ${filters.endYear}`
  const forecastChartAria = `Line chart comparing forecast predicted counts to observed actuals where available between ${filters.startYear} and ${filters.endYear}`

  const showNonScrollChrome = activeTab !== 'scroll' && !presentationMode
  const backendBannerText =
    !OFFLINE_MODE && !backendBannerHidden && activeTab !== 'scroll' && dashboardRetryCountRef.current >= 2
      ? 'Backend is not reachable. Start FastAPI on port 8000.'
      : ''

  useEffect(() => {
    setForecastVisibleCount(40)
  }, [forecastRows])

  const forecastSummary = useMemo(() => {
    if (!forecastRows.length) return null
    const neighborhoodSet = new Set(forecastRows.map((r) => String(r.neighborhood_number ?? r.neighborhood_name ?? '')))
    const monthSet = new Set(forecastRows.map((r) => String(r.month_start ?? '')))
    const months = Array.from(monthSet)
      .filter(Boolean)
      .sort((a, b) => String(a).localeCompare(String(b)))
    const formatter = new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric' })
    const formatShort = (raw) => {
      const d = new Date(`${raw}T00:00:00`)
      if (Number.isNaN(d.getTime())) return raw
      return formatter.format(d)
    }
    const first = months[0] ? formatShort(months[0]) : ''
    const last = months.length ? formatShort(months[months.length - 1]) : ''
    return `${neighborhoodSet.size} neighborhoods · ${months.length} months · ${first}${first && last ? '–' : ''}${last}`
  }, [forecastRows])

  return (
    <main id="dashboard-main" className="dashboard">
      {presentationMode ? (
        <Presentation
          onExit={() => setPresentationMode(false)}
          onSwitchTab={(tab) => {
            setActiveTab(tab)
            setPresentationMode(false)
          }}
        />
      ) : null}
      <header className="dashboard-header">
        <div className="dashboard-header-row">
          <div className="dashboard-header-title-wrap">
            <h1>Datamining & Machine Learning Final Project</h1>
            <span className="dashboard-header-separator" aria-hidden />
            <p className="dashboard-header-sub-inline">St. Paul Police Staffing Analysis</p>
          </div>
          <span className="dashboard-live-badge" aria-label="Dashboard connected to live data">
            <span className="dashboard-live-dot" aria-hidden />
            Live
          </span>
        </div>
      </header>

      <section className="tabs-shell">
        <div className="tabs" role="tablist" aria-label="Dashboard sections">
          <button
            role="tab"
            type="button"
            className={activeTab === 'scroll' ? 'tab active' : 'tab'}
            aria-selected={activeTab === 'scroll'}
            onClick={() => setActiveTab('scroll')}
          >
            Home
          </button>
          <button
            role="tab"
            type="button"
            className={activeTab === 'analytics' ? 'tab active' : 'tab'}
            aria-selected={activeTab === 'analytics'}
            onClick={() => setActiveTab('analytics')}
          >
            Analytics
          </button>
          <button
            role="tab"
            type="button"
            className={activeTab === 'forecast' ? 'tab active' : 'tab'}
            aria-selected={activeTab === 'forecast'}
            onClick={() => setActiveTab('forecast')}
          >
            Forecast
          </button>
          <button
            role="tab"
            type="button"
            className={activeTab === 'map' ? 'tab active' : 'tab'}
            aria-selected={activeTab === 'map'}
            onClick={() => setActiveTab('map')}
          >
            Spatial Map
          </button>
          <button
            type="button"
            className="tab tab-present"
            aria-label="Start full-screen slide presentation mode"
            onClick={() => setPresentationMode(true)}
          >
            ▶ Present
          </button>
        </div>
        <p className={`tab-caption ${showNonScrollChrome ? 'visible' : ''}`} aria-live="polite">
          {showNonScrollChrome ? TAB_HINTS[activeTab] : '\u00a0'}
        </p>
      </section>

      <div className="toast-stack" aria-live="polite" aria-relevant="additions removals">
        {backendBannerText ? (
          <div className="toast toast--error" role="status">
            <div className="toast__msg">{backendBannerText}</div>
            <button
              type="button"
              className="toast__x"
              aria-label="Dismiss"
              onClick={() => setBackendBannerHidden(true)}
            >
              ✕
            </button>
            <div className="toast__progress" aria-hidden />
          </div>
        ) : null}
        {toastItems.map((item) => (
          <div
            key={item.id}
            className={`toast ${item.variant === 'warn' ? 'toast--warn' : 'toast--error'}`}
            role="status"
          >
            <div className="toast__msg">{item.message}</div>
            <button type="button" className="toast__x" aria-label="Dismiss" onClick={() => dismissToast(item.id)}>
              ✕
            </button>
            <div className="toast__progress" aria-hidden />
          </div>
        ))}
      </div>

      <ErrorBoundary>
        {OFFLINE_MODE ? (
          <section className="offline-banner card" role="status" aria-label="Offline mode">
            <h2>Dashboard running in offline mode — connect a FastAPI backend to see live data</h2>
            <p className="subtle">
              dataminingfinal.vercel.app is the static frontend only. See the README for setup instructions.
            </p>
            <a className="offline-link" href="/README.md" target="_blank" rel="noopener noreferrer">
              Open setup README
            </a>
          </section>
        ) : null}
        {!presentationMode && showNonScrollChrome ? (
          <>
            <button
              type="button"
              className="filters-toggle-btn"
              aria-expanded={filtersExpanded}
              onClick={() => setFiltersExpanded((previous) => !previous)}
            >
              Filters ▾
            </button>
            <section
              className={`filters card filters--collapse ${filtersExpanded ? 'filters--expanded' : ''}`}
              aria-label="Dashboard filters"
            >
              <div className="filter-field">
                <label htmlFor="startYear">Start Year</label>
                <input
                  id="startYear"
                  type="number"
                  min={YEAR_MIN}
                  max={YEAR_MAX}
                  value={yearDraft.startYear}
                  onChange={(event) =>
                    setYearDraft((draft) => ({ ...draft, startYear: Number(event.target.value) }))
                  }
                />
              </div>
              <div className="filter-field">
                <label htmlFor="endYear">End Year</label>
                <input
                  id="endYear"
                  type="number"
                  min={YEAR_MIN}
                  max={YEAR_MAX}
                  value={yearDraft.endYear}
                  onChange={(event) =>
                    setYearDraft((draft) => ({ ...draft, endYear: Number(event.target.value) }))
                  }
                />
              </div>
              <div className="filter-field">
                <label htmlFor="neighborhoodNumber">Neighborhood</label>
                <select id="neighborhoodNumber" value={filters.neighborhoodNumber} onChange={(event) => updateFilter('neighborhoodNumber', event.target.value)}>
                  <option value="">All neighborhoods</option>
                  {availableFilters.neighborhoods.map((item) => (
                    <option key={item.neighborhood_number} value={item.neighborhood_number}>
                      {formatNeighborhoodDisplayName(item.neighborhood_name)}
                    </option>
                  ))}
                </select>
              </div>
            </section>
            <div className="filter-hint-row">
              <span>{filterSummaryLine}</span>
              <button
                type="button"
                className="refresh-btn"
                title="Refresh data (clear cache)"
                aria-label="Refresh data (clear cache)"
                onClick={() => {
                  clearCache()
                  setRefreshNonce((n) => n + 1)
                }}
              >
                ↺ Refresh
              </button>
            </div>
            {yearRangeInvalid ? <p className="filter-year-error">Start year cannot be after end year.</p> : null}
          </>
        ) : null}

        {activeTab === 'scroll' ? (
          <PresentationScroll layout="home" onSwitchTab={(tab) => setActiveTab(tab)} />
        ) : activeTab === 'analytics' ? (
          <>
            <section className="kpi-grid" aria-label="Key staffing metrics overview">
              {KPI_DEFS.map((definition) => (
                <article key={definition.key} className="kpi-card card">
                  <h2>
                    <span className="kpi-title-row">
                      <span>{definition.label}</span>
                      <span className="kpi-tooltip-wrap">
                        <span className="kpi-tooltip-icon" tabIndex={0} aria-label={`About ${definition.label}`}>
                          ⓘ
                        </span>
                        <span role="tooltip" className="kpi-tooltip-text">
                          {definition.tip}
                        </span>
                      </span>
                    </span>
                  </h2>
                  <strong className={isLoading ? 'kpi-loading' : ''}>
                    {showSkeleton ? (
                      <span className="skeleton-bar" />
                    ) : (
                      formatNumber(
                        kpis?.[definition.key],
                        definition.key === 'avg_actual_total_count' || definition.key === 'avg_predicted_total_count' ? 1 : 2,
                      )
                    )}
                  </strong>
                </article>
              ))}
            </section>

            <section className="panel card">
              <h2>Month Trend</h2>
              {showSkeleton ? (
                <div className="trend-svg panel-skeleton-inner skeleton-bar" aria-busy="true" aria-label="Trend chart loading" />
              ) : (
                <TrendChart rows={trendRows} chartAriaLabel={trendChartAria} />
              )}
            </section>

            <section className="panel card">
              <h2>Highest/Lowest Need Month</h2>
              {showSkeleton ? (
                <div className="extreme-placeholder skeleton-bar" aria-busy="true" aria-label="Extremes loading" />
              ) : !extremes?.highest_need_month && !extremes?.lowest_need_month ? (
                <p className="empty-state">
                  No highest or lowest staffing months found for this date range and neighborhood. Try widening the year range or choosing All Neighborhoods.
                </p>
              ) : (
                <div className="extreme-grid">
                  <div className="extreme-card card">
                    <h3>Highest Need</h3>
                    <p className="extreme-date">{formatMonthYear(extremes?.highest_need_month?.month_start)}</p>
                    <p className="extreme-neighborhood">{formatNeighborhoodDisplayName(extremes?.highest_need_month?.neighborhood_name)}</p>
                    <p className="extreme-score">Score: {formatNumber(extremes?.highest_need_month?.staffing_strength_score_0_100, 2)}</p>
                  </div>
                  <div className="extreme-card card">
                    <h3>Lowest Need</h3>
                    <p className="extreme-date">{formatMonthYear(extremes?.lowest_need_month?.month_start)}</p>
                    <p className="extreme-neighborhood">{formatNeighborhoodDisplayName(extremes?.lowest_need_month?.neighborhood_name)}</p>
                    <p className="extreme-score">Score: {formatNumber(extremes?.lowest_need_month?.staffing_strength_score_0_100, 2)}</p>
                  </div>
                </div>
              )}
            </section>

            <section className="panel card">
              <h2>Neighborhood Summary Table</h2>
              {showSkeleton ? (
                <div className="table-scroll">
                  <div className="panel-skeleton-inner skeleton-bar" aria-busy="true" style={{ height: '140px', width: '100%' }} aria-label="Summary table loading" />
                </div>
              ) : !summaryRows.length ? (
                <p className="empty-state">
                  No aggregate neighborhood rows returned for these filters yet. Expand the date range or clear the neighborhood filter to see totals.
                </p>
              ) : (
                <div className="table-scroll">
                  <table role="table" aria-label="Average actual, predicted, error, and staffing score by neighborhood">
                    <caption className="table-caption subtle">
                      Summary of model accuracy signals by neighborhood ID.
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">ID</th>
                        <th scope="col">Neighborhood</th>
                        <th scope="col">Avg Actual</th>
                        <th scope="col">Avg Predicted</th>
                        <th scope="col">Avg APE %</th>
                        <th scope="col">Avg Staffing Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summaryRows.map((row) => (
                        <tr key={row.neighborhood_number}>
                          <td>{row.neighborhood_number}</td>
                          <td>{formatNeighborhoodDisplayName(row.neighborhood_name)}</td>
                          <td>{formatNumber(row.avg_actual_total_count, 2)}</td>
                          <td>{formatNumber(row.avg_predicted_total_count, 2)}</td>
                          <td>{formatNumber(row.avg_ape_total_pct, 2)}</td>
                          <td>{formatNumber(row.avg_staffing_score, 2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="panel card">
              <h2>Category Actual vs Predicted Counts</h2>
              <p className="subtle">
                Includes 5-category APE% (Narcotic, Property Damage, Property Theft, Violent Person, Weapons).
              </p>
              <div className="filter-field category-inline">
                <label htmlFor="categoryCompare">Category</label>
                <select id="categoryCompare" value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)}>
                  <option value="">All categories (no category table)</option>
                  {availableFilters.categories.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
              <div className="filter-field category-inline">
                <label htmlFor="categoryYear">Category Year</label>
                <select id="categoryYear" value={selectedCategoryYear} onChange={(event) => setSelectedCategoryYear(event.target.value)}>
                  {availableFilters.years.map((yearValue) => (
                    <option key={yearValue} value={String(yearValue)}>
                      {yearValue}
                    </option>
                  ))}
                </select>
              </div>
              {!filters.neighborhoodNumber ? <p className="subtle">Select a neighborhood at the top to view category counts.</p> : null}
              {filters.neighborhoodNumber && selectedCategory === '' ? (
                showSkeleton ? (
                  <div className="panel-skeleton-inner skeleton-bar" aria-busy="true" style={{ height: '120px', width: '100%' }} aria-label="Category table loading" />
                ) : !allCategoryRows.length ? (
                  <p className="empty-state">
                    No monthly category totals for this neighborhood and category year yet. Confirm the API has category rows for your selection.
                  </p>
                ) : (
                  <div className="table-scroll">
                    <table role="table" aria-label="Actual versus predicted counts for all categories by month">
                      <thead>
                        <tr>
                          <th scope="col">Month</th>
                          <th scope="col">Narcotic (A vs P)</th>
                          <th scope="col">Property Damage (A vs P)</th>
                          <th scope="col">Property Theft (A vs P)</th>
                          <th scope="col">Violent Person (A vs P)</th>
                          <th scope="col">Weapons (A vs P)</th>
                          <th scope="col">5-Category APE %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allCategoryRows.map((row) => (
                          <tr key={`all-${row.month_start}`}>
                            <td>{formatMonthYear(row.month_start)}</td>
                            <td>{`${formatNumber(row.actual_narcotic_count, 2)} vs ${formatNumber(row.predict_narcotic_count, 2)}`}</td>
                            <td>{`${formatNumber(row.actual_property_damage_count, 2)} vs ${formatNumber(row.predict_property_damage_count, 2)}`}</td>
                            <td>{`${formatNumber(row.actual_property_theft_count, 2)} vs ${formatNumber(row.predict_property_theft_count, 2)}`}</td>
                            <td>{`${formatNumber(row.actual_violent_person_count, 2)} vs ${formatNumber(row.predict_violent_person_count, 2)}`}</td>
                            <td>{`${formatNumber(row.actual_weapons_count, 2)} vs ${formatNumber(row.predict_weapons_count, 2)}`}</td>
                            <td>{formatNumber(row.ape_5_category_pct, 2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              ) : null}
              {selectedCategory && filters.neighborhoodNumber ? (
                showSkeleton ? (
                  <div className="panel-skeleton-inner skeleton-bar" aria-busy="true" style={{ height: '100px', width: '100%' }} aria-label="Single category chart loading" />
                ) : !categoryTrendRows.length ? (
                  <p className="empty-state">No category-level trend rows matched this selector yet.</p>
                ) : (
                  <div className="table-scroll">
                    <table role="table" aria-label={`${selectedCategory} actual versus predicted counts by month`}>
                      <thead>
                        <tr>
                          <th scope="col">Month</th>
                          <th scope="col">Actual Count</th>
                          <th scope="col">Predicted Count</th>
                          <th scope="col">Difference (Actual − Predicted)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {categoryTrendRows.map((row) => (
                          <tr key={row.month_start}>
                            <td>{formatMonthYear(row.month_start)}</td>
                            <td>{formatNumber(row.actual_count, 2)}</td>
                            <td>{formatNumber(row.predicted_count, 2)}</td>
                            <td>{formatNumber(Number(row.actual_count) - Number(row.predicted_count), 2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              ) : selectedCategory === '' ? null : !filters.neighborhoodNumber ? null : (
                <p className="subtle">Select a category to show month-by-month actual and predicted counts.</p>
              )}
            </section>

            <section className="panel card">
              <details>
                <summary className="guide-summary">Analytics Guide</summary>
                <div className="guide-grid">
                  <article className="card">
                    <h3>What APE means</h3>
                    <p>APE is the absolute percent error for total crime count at each neighborhood-month</p>
                  </article>
                  <article className="card">
                    <h3>What Category APE means</h3>
                    <p>Category WAPE is weighted error across category counts Values over 100% mean the total miss is larger than the observed counts.</p>
                  </article>
                  <article className="card">
                    <h3>How staffing score is used</h3>
                    <p>The staffing strength score (0-100) is your composite demand signal from predicted crime mix and policy weights. Higher score means comparatively higher staffing pressure for that month and neighborhood.</p>
                  </article>
                </div>
              </details>
            </section>
          </>
        ) : activeTab === 'forecast' ? (
          <section className="panel card">
            <h2>Forecast Results</h2>
            <p className="subtle">Frozen forecast table filtered by current year range and neighborhood.</p>
            {forecastSummary ? <p className="subtle">{forecastSummary}</p> : null}
            {!isLoading && !forecastTrendRows.length ? (
              <p className="empty-state">
                No forecast trend rows for these filters yet. Narrow to 2026 and the neighborhood bundle you exported.
              </p>
            ) : null}
            {showSkeleton ? (
              <div className="panel-skeleton-inner skeleton-bar" style={{ height: '200px', width: '100%', marginBottom: '12px' }} />
            ) : (
              <ForecastTrendChart rows={forecastTrendRows} chartAriaLabel={forecastChartAria} />
            )}
            {!forecastRows.length && !isLoading ? (
              <p className="empty-state">
                No forecast allocations returned yet. Forecast data is keyed to frozen 2026 exports — adjust years or neighborhoods if you expect rows.
              </p>
            ) : null}
            <div className="table-scroll">
              <table
                role="table"
                className="forecast-table"
                aria-label="Frozen forecast allocations with staffing scores"
              >
                <thead>
                  <tr>
                    <th scope="col" className="forecast-head-group-a">Month</th>
                    <th scope="col" className="forecast-head-group-a">Neighborhood</th>
                    <th scope="col" className="forecast-head-group-b">Pred Total</th>
                    <th scope="col" className="forecast-head-group-a">Violent</th>
                    <th scope="col" className="forecast-head-group-a">Weapons</th>
                    <th scope="col" className="forecast-head-group-b">Theft</th>
                    <th scope="col" className="forecast-head-group-b">Damage</th>
                    <th scope="col" className="forecast-head-group-b">Narcotics</th>
                    <th scope="col" className="forecast-head-group-a">Proactive Visits</th>
                    <th scope="col" className="forecast-head-group-a">Other</th>
                    <th scope="col" className="forecast-head-primary">Staffing Score</th>
                    <th scope="col" className="forecast-head-group-a">5-Category APE %</th>
                    <th scope="col" className="forecast-head-group-b">Staffing Proportion</th>
                    <th scope="col" className="forecast-head-primary">Allocated Staff</th>
                  </tr>
                </thead>
                <tbody>
                  {forecastRows.slice(0, Math.min(forecastVisibleCount, forecastRows.length)).map((row, rowIndex) => {
                    const fc = (i) =>
                      `${Math.floor(i / 3) % 2 === 0 ? 'forecast-band-a' : 'forecast-band-b'}${i === 10 || i === 13 ? ' forecast-strong' : ''}`
                    return (
                      <tr key={`${row.month_start}-${row.neighborhood_number}-${rowIndex}`}>
                        <td className={fc(0)}>{formatMonthYear(row.month_start)}</td>
                        <td className={fc(1)}>{row.neighborhood_name}</td>
                        <td className={fc(2)}>{formatNumber(row.predict_crime_count, 2)}</td>
                        <td className={fc(3)}>{formatNumber(row.predict_violent_person_count, 2)}</td>
                        <td className={fc(4)}>{formatNumber(row.predict_weapons_count, 2)}</td>
                        <td className={fc(5)}>{formatNumber(row.predict_property_theft_count, 2)}</td>
                        <td className={fc(6)}>{formatNumber(row.predict_property_damage_count, 2)}</td>
                        <td className={fc(7)}>{formatNumber(row.predict_narcotic_count, 2)}</td>
                        <td className={fc(8)}>{formatNumber(row.predict_proactive_police_visits_count, 2)}</td>
                        <td className={fc(9)}>{formatNumber(row.predict_other_count, 2)}</td>
                        <td className={fc(10)}>{formatNumber(row.staffing_strength_score_0_100, 2)}</td>
                        <td className={fc(11)}>{formatNumber(row.ape_5_category_pct, 2)}</td>
                        <td className={fc(12)}>{formatNumber(Number(row.neighborhood_staffing_proportion) * 100, 2)}%</td>
                        <td className={fc(13)}>{formatNumber(row.neighborhood_allocated_staff_count, 2)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {forecastRows.length > forecastVisibleCount ? (
              <button
                type="button"
                className="forecast-load-more"
                onClick={() => setForecastVisibleCount((c) => c + 40)}
              >
                Showing {Math.min(forecastVisibleCount, forecastRows.length)} of {forecastRows.length} rows — Load 40 more
              </button>
            ) : null}
          </section>
        ) : (
          <section className="panel card">
            <h2>Crime Hotspot Timelapse Map</h2>
            <p className="subtle">Month-by-month hotspot intensity by neighborhood. Use play for timelapse.</p>
            <div className="map-controls">
              <div className="filter-field map-field">
                <label htmlFor="mapYear">Map Year</label>
                <select id="mapYear" value={mapYear} onChange={(event) => setMapYear(event.target.value)}>
                  <option value="all">All Years (2014–2026)</option>
                  {availableFilters.years.map((yearValue) => (
                    <option key={yearValue} value={String(yearValue)}>
                      {yearValue}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                aria-label={
                  isMapPlaying ? 'Pause crime hotspot timelapse animation' : 'Play crime hotspot timelapse animation'
                }
                className={`play-button${isMapPlaying ? ' playing' : ''}`}
                onClick={() => setIsMapPlaying((previous) => !previous)}
              >
                {isMapPlaying ? '⏸ Pause' : '▶ Play Timelapse'}
              </button>
            </div>
            <div className="map-month-badge">
              <span className="map-month-label">Viewing</span>
              <span className="map-month-value">{selectedMapMonth ? formatMonthYear(selectedMapMonth) : 'No month selected'}</span>
              <span className="map-month-count">{selectedMapRows.length} neighborhoods</span>
            </div>
            {mapLoading ? (
              <div className="panel-skeleton-inner skeleton-bar" aria-busy="true" style={{ height: '220px', width: '100%' }} aria-label="Hotspot map loading" />
            ) : (
              <HotspotMap monthRows={selectedMapRows} monthLabel={selectedMapMonth} />
            )}
            <div className="month-scrubber">
              <input
                type="range"
                min={0}
                max={Math.max(0, mapMonths.length - 1)}
                value={Math.min(mapMonthIndex, Math.max(0, mapMonths.length - 1))}
                aria-label="Select month for hotspot display"
                aria-valuetext={selectedMapMonth ? formatMonthYear(selectedMapMonth) : 'No month selected'}
                aria-valuemax={Math.max(0, mapMonths.length - 1)}
                aria-valuemin={0}
                onChange={(event) => setMapMonthIndex(Number(event.target.value))}
              />
            </div>
          </section>
        )}
      </ErrorBoundary>
    </main>
  )
}

export default App
