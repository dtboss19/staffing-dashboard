import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'

const defaultFilterState = {
  startYear: 2014,
  endYear: 2026,
  neighborhoodNumber: '',
}

function formatNumber(value, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return 'N/A'
  }
  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

function formatDateLabel(value) {
  if (!value) return ''
  const normalizedDateString = String(value).split(' ')[0]
  const parsedDate = new Date(`${normalizedDateString}T00:00:00`)
  if (Number.isNaN(parsedDate.getTime())) return value
  return parsedDate.toLocaleDateString(undefined, { month: 'short', year: '2-digit' })
}

function formatMonthYear(value) {
  if (!value) return 'N/A'
  const normalizedDateString = String(value).split(' ')[0]
  const parsedDate = new Date(`${normalizedDateString}T00:00:00`)
  if (Number.isNaN(parsedDate.getTime())) return value
  return parsedDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

function formatQuarterLabel(value) {
  if (!value) return ''
  const normalizedDateString = String(value).split(' ')[0]
  const parsedDate = new Date(`${normalizedDateString}T00:00:00`)
  if (Number.isNaN(parsedDate.getTime())) return value
  const quarterNumber = Math.floor(parsedDate.getMonth() / 3) + 1
  const yearShort = String(parsedDate.getFullYear()).slice(-2)
  return `Q${quarterNumber} '${yearShort}`
}

function formatNeighborhoodDisplayName(value) {
  if (!value) return 'N/A'
  return String(value).replace(/^\d+\s*-\s*/, '').trim()
}

function toQueryString(filters) {
  const queryParameters = new URLSearchParams()
  queryParameters.set('start_year', filters.startYear)
  queryParameters.set('end_year', filters.endYear)
  if (filters.neighborhoodNumber) {
    queryParameters.set('neighborhood_number', filters.neighborhoodNumber)
  }
  return queryParameters.toString()
}

function TrendChart({ rows, actualKey = 'actual_total_count', predictedKey = 'predicted_total_count', title = 'Monthly Actual vs Predicted Totals' }) {
  if (!rows.length) {
    return <p className="empty-state">No trend data for current filters.</p>
  }

  const svgReference = useRef(null)
  const [hoveredIndex, setHoveredIndex] = useState(null)
  const width = 980
  const height = 280
  const padding = 48
  const values = rows.flatMap((row) => [Number(row[actualKey]), Number(row[predictedKey])])
  const maxValue = Math.max(...values, 1)
  const yTicks = 5
  const stepX = rows.length > 1 ? (width - padding * 2) / (rows.length - 1) : 1
  const toY = (value) => height - padding - (Number(value) / maxValue) * (height - padding * 2)
  const parsedDates = rows.map((row) => new Date(`${row.month_start}T00:00:00`))
  const isLongRange = rows.length > 24
  const xTickIndexes = []
  parsedDates.forEach((dateValue, index) => {
    if (Number.isNaN(dateValue.getTime())) return
    const monthNumber = dateValue.getMonth() + 1
    if (isLongRange) {
      if (rows.length > 72) {
        if (monthNumber === 1) xTickIndexes.push(index)
      } else if ([1, 4, 7, 10].includes(monthNumber)) {
        xTickIndexes.push(index)
      }
    } else if (rows.length > 12) {
      if ([1, 4, 7, 10].includes(monthNumber)) xTickIndexes.push(index)
    } else {
      xTickIndexes.push(index)
    }
  })

  const actualPath = rows
    .map((row, index) => `${index === 0 ? 'M' : 'L'} ${padding + index * stepX} ${toY(row[actualKey])}`)
    .join(' ')
  const predictedPath = rows
    .map((row, index) => `${index === 0 ? 'M' : 'L'} ${padding + index * stepX} ${toY(row[predictedKey])}`)
    .join(' ')

  function handleMouseMove(event) {
    if (!svgReference.current || rows.length < 2) return
    const box = svgReference.current.getBoundingClientRect()
    const relativeX = event.clientX - box.left
    const domainWidth = box.width - ((padding * 2 * box.width) / width)
    const paddingScaled = (padding * box.width) / width
    const unclampedIndex = Math.round(((relativeX - paddingScaled) / Math.max(domainWidth, 1)) * (rows.length - 1))
    const clampedIndex = Math.max(0, Math.min(rows.length - 1, unclampedIndex))
    setHoveredIndex(clampedIndex)
  }

  const hoveredRow = hoveredIndex !== null ? rows[hoveredIndex] : null
  const hoveredX = hoveredIndex !== null ? padding + hoveredIndex * stepX : null
  const hoveredActualY = hoveredRow ? toY(hoveredRow[actualKey]) : null
  const hoveredPredictedY = hoveredRow ? toY(hoveredRow[predictedKey]) : null

  return (
    <div className="trend-wrapper">
      <svg
        ref={svgReference}
        className="trend-svg"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Actual and predicted trend lines"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredIndex(null)}
      >
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} className="axis" />
        <line x1={padding} y1={padding} x2={padding} y2={height - padding} className="axis" />
        {Array.from({ length: yTicks + 1 }, (_, index) => {
          const yValue = (maxValue / yTicks) * (yTicks - index)
          const yPosition = padding + ((height - padding * 2) * index) / yTicks
          return (
            <g key={`y-${index}`}>
              <line x1={padding} y1={yPosition} x2={width - padding} y2={yPosition} className="grid-line" />
              <text x={padding - 8} y={yPosition + 4} className="axis-label axis-label-y">
                {Math.round(yValue)}
              </text>
            </g>
          )
        })}
        {xTickIndexes.map((rowIndex) => {
          const xPosition = padding + rowIndex * stepX
          return (
            <g key={`x-${rowIndex}`}>
              <line x1={xPosition} y1={height - padding} x2={xPosition} y2={height - padding + 5} className="axis" />
              <text x={xPosition} y={height - padding + 20} className="axis-label axis-label-x">
                {isLongRange ? formatQuarterLabel(rows[rowIndex]?.month_start) : formatDateLabel(rows[rowIndex]?.month_start)}
              </text>
            </g>
          )
        })}
        <path d={actualPath} className="actual-line" />
        <path d={predictedPath} className="predicted-line" />
        {hoveredRow ? (
          <g>
            <line x1={hoveredX} y1={padding} x2={hoveredX} y2={height - padding} className="hover-line" />
            <circle cx={hoveredX} cy={hoveredActualY} r="4" className="hover-dot actual-dot" />
            <circle cx={hoveredX} cy={hoveredPredictedY} r="4" className="hover-dot predicted-dot" />
          </g>
        ) : null}
        <text x={padding} y={16} className="chart-title">{title}</text>
      </svg>
      {hoveredRow ? (
        <div className="chart-tooltip">
          <div>{formatDateLabel(hoveredRow.month_start)}</div>
          <div>Actual: {formatNumber(hoveredRow[actualKey], 2)}</div>
          <div>Predicted: {formatNumber(hoveredRow[predictedKey], 2)}</div>
        </div>
      ) : null}
      <div className="trend-legend">
        <span><i className="legend-dot actual" /> Actual Total Count</span>
        <span><i className="legend-dot predicted" /> Predicted Total Count</span>
      </div>
    </div>
  )
}

function ForecastTrendChart({ rows }) {
  if (!rows.length) {
    return <p className="empty-state">No forecast trend data for current filters.</p>
  }

  const svgReference = useRef(null)
  const [hoveredIndex, setHoveredIndex] = useState(null)
  const width = 980
  const height = 260
  const padding = 48
  const values = rows.flatMap((row) => [
    Number(row.predicted_total_count),
    row.actual_total_count === null || row.actual_total_count === undefined ? 0 : Number(row.actual_total_count),
  ])
  const maxValue = Math.max(...values, 1)
  const yTicks = 5
  const stepX = rows.length > 1 ? (width - padding * 2) / (rows.length - 1) : 1
  const toY = (value) => height - padding - (Number(value) / maxValue) * (height - padding * 2)
  const pathData = rows
    .map((row, index) => `${index === 0 ? 'M' : 'L'} ${padding + index * stepX} ${toY(row.predicted_total_count)}`)
    .join(' ')
  const actualPathRows = rows
    .map((row, index) => ({
      hasActual: row.actual_total_count !== null && row.actual_total_count !== undefined,
      x: padding + index * stepX,
      y: row.actual_total_count !== null && row.actual_total_count !== undefined ? toY(row.actual_total_count) : null,
    }))
    .filter((row) => row.hasActual)
  const actualPathData = actualPathRows
    .map((row, index) => `${index === 0 ? 'M' : 'L'} ${row.x} ${row.y}`)
    .join(' ')

  const xTickIndexes = []
  rows.forEach((row, index) => {
    const parsedDate = new Date(`${row.month_start}T00:00:00`)
    if (Number.isNaN(parsedDate.getTime())) return
    if ((parsedDate.getMonth() + 1) % 3 === 1 || rows.length <= 12) {
      xTickIndexes.push(index)
    }
  })

  function handleMouseMove(event) {
    if (!svgReference.current || rows.length < 2) return
    const box = svgReference.current.getBoundingClientRect()
    const relativeX = event.clientX - box.left
    const domainWidth = box.width - ((padding * 2 * box.width) / width)
    const paddingScaled = (padding * box.width) / width
    const unclampedIndex = Math.round(((relativeX - paddingScaled) / Math.max(domainWidth, 1)) * (rows.length - 1))
    const clampedIndex = Math.max(0, Math.min(rows.length - 1, unclampedIndex))
    setHoveredIndex(clampedIndex)
  }

  const hoveredRow = hoveredIndex !== null ? rows[hoveredIndex] : null
  const hoveredX = hoveredIndex !== null ? padding + hoveredIndex * stepX : null
  const hoveredPredictedY = hoveredRow ? toY(hoveredRow.predicted_total_count) : null
  const hoveredActualY = hoveredRow && hoveredRow.actual_total_count !== null && hoveredRow.actual_total_count !== undefined
    ? toY(hoveredRow.actual_total_count)
    : null

  return (
    <div className="trend-wrapper">
      <svg
        ref={svgReference}
        className="trend-svg"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Forecasted crime count trend"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredIndex(null)}
      >
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} className="axis" />
        <line x1={padding} y1={padding} x2={padding} y2={height - padding} className="axis" />
        {Array.from({ length: yTicks + 1 }, (_, index) => {
          const yValue = (maxValue / yTicks) * (yTicks - index)
          const yPosition = padding + ((height - padding * 2) * index) / yTicks
          return (
            <g key={`forecast-y-${index}`}>
              <line x1={padding} y1={yPosition} x2={width - padding} y2={yPosition} className="grid-line" />
              <text x={padding - 8} y={yPosition + 4} className="axis-label axis-label-y">
                {Math.round(yValue)}
              </text>
            </g>
          )
        })}
        {xTickIndexes.map((index) => {
          const xPosition = padding + index * stepX
          return (
            <g key={`forecast-x-${index}`}>
              <line x1={xPosition} y1={height - padding} x2={xPosition} y2={height - padding + 5} className="axis" />
              <text x={xPosition} y={height - padding + 20} className="axis-label axis-label-x">
                {formatDateLabel(rows[index].month_start)}
              </text>
            </g>
          )
        })}
        {actualPathData ? <path d={actualPathData} className="forecast-actual-line" /> : null}
        <path d={pathData} className="forecast-line" />
        {hoveredRow ? (
          <g>
            <line x1={hoveredX} y1={padding} x2={hoveredX} y2={height - padding} className="hover-line" />
            <circle cx={hoveredX} cy={hoveredPredictedY} r="4" className="hover-dot forecast-dot" />
            {hoveredActualY !== null ? <circle cx={hoveredX} cy={hoveredActualY} r="4" className="hover-dot actual-dot" /> : null}
          </g>
        ) : null}
        <text x={padding} y={16} className="chart-title">Forecasted Crime Count Trend</text>
      </svg>
      {hoveredRow ? (
        <div className="chart-tooltip">
          <div>{formatDateLabel(hoveredRow.month_start)}</div>
          <div>Predicted: {formatNumber(hoveredRow.predicted_total_count, 2)}</div>
          <div>Actual: {hoveredRow.actual_total_count !== null && hoveredRow.actual_total_count !== undefined ? formatNumber(hoveredRow.actual_total_count, 2) : 'N/A'}</div>
        </div>
      ) : null}
      <div className="trend-legend">
        <span><i className="legend-dot actual" /> Actual Total Count</span>
        <span><i className="legend-dot forecast" /> Predicted Crime Count</span>
      </div>
    </div>
  )
}

const neighborhoodMapPositions = {
  1: { x: 86, y: 242 },
  2: { x: 166, y: 214 },
  3: { x: 92, y: 168 },
  4: { x: 177, y: 182 },
  5: { x: 238, y: 178 },
  6: { x: 206, y: 132 },
  7: { x: 112, y: 112 },
  8: { x: 150, y: 112 },
  9: { x: 96, y: 208 },
  10: { x: 155, y: 72 },
  11: { x: 188, y: 96 },
  12: { x: 222, y: 108 },
  13: { x: 144, y: 142 },
  14: { x: 112, y: 178 },
  15: { x: 86, y: 212 },
  16: { x: 126, y: 156 },
  17: { x: 262, y: 156 },
}

function HotspotMap({ monthRows, monthLabel }) {
  if (!monthRows.length) {
    return <p className="empty-state">No hotspot data for selected month.</p>
  }
  const width = 360
  const height = 300
  const maxActual = Math.max(...monthRows.map((row) => Number(row.actual_total_count || 0)), 1)

  return (
    <div className="hotspot-map-wrap">
      <svg className="hotspot-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Neighborhood hotspot map">
        <rect x="12" y="12" width={width - 24} height={height - 24} rx="14" className="map-base" />
        {monthRows.map((row) => {
          const position = neighborhoodMapPositions[row.neighborhood_number]
          if (!position) return null
          const intensity = Number(row.actual_total_count || 0) / maxActual
          const radius = 10 + intensity * 20
          const fillOpacity = 0.28 + intensity * 0.62
          return (
            <g key={row.neighborhood_number}>
              <circle cx={position.x} cy={position.y} r={radius} className="hotspot-circle" style={{ opacity: fillOpacity }} />
              <circle cx={position.x} cy={position.y} r="2.5" className="hotspot-center" />
              <text x={position.x + radius + 4} y={position.y + 4} className="hotspot-label">
                {formatNeighborhoodDisplayName(row.neighborhood_name)}
              </text>
              <title>
                {`${formatNeighborhoodDisplayName(row.neighborhood_name)} | Actual: ${formatNumber(row.actual_total_count, 2)} | Predicted: ${formatNumber(row.predicted_total_count, 2)}`}
              </title>
            </g>
          )
        })}
      </svg>
      <p className="subtle">{monthLabel ? `Hotspots for ${monthLabel}` : 'Hotspots by month'}</p>
    </div>
  )
}

function App() {
  const [activeTab, setActiveTab] = useState('analytics')
  const [filters, setFilters] = useState(defaultFilterState)
  const [availableFilters, setAvailableFilters] = useState({ years: [], neighborhoods: [], categories: [] })
  const [kpis, setKpis] = useState(null)
  const [summaryRows, setSummaryRows] = useState([])
  const [trendRows, setTrendRows] = useState([])
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedCategoryYear, setSelectedCategoryYear] = useState('')
  const [categoryTrendRows, setCategoryTrendRows] = useState([])
  const [extremes, setExtremes] = useState(null)
  const [forecastRows, setForecastRows] = useState([])
  const [forecastTrendRows, setForecastTrendRows] = useState([])
  const [mapYear, setMapYear] = useState('all')
  const [mapMonths, setMapMonths] = useState([])
  const [mapRows, setMapRows] = useState([])
  const [mapMonthIndex, setMapMonthIndex] = useState(0)
  const [isMapPlaying, setIsMapPlaying] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const baseQuery = useMemo(() => toQueryString(filters), [filters])

  useEffect(() => {
    async function loadFilterOptions() {
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
        setSelectedCategoryYear(String(largestYear))
        setMapYear('all')
      }
    }
    loadFilterOptions().catch(() => {
      setErrorMessage('Backend is not reachable. Start FastAPI on port 8000.')
    })
  }, [])

  useEffect(() => {
    async function loadDashboardData() {
      setIsLoading(true)
      setErrorMessage('')
      try {
        const [kpiResponse, summaryResponse, trendResponse, extremesResponse, forecastResponse, forecastTrendResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/kpis?${baseQuery}`),
          fetch(`${API_BASE_URL}/neighborhood-summary?start_year=${filters.startYear}&end_year=${filters.endYear}${filters.neighborhoodNumber ? `&neighborhood_number=${filters.neighborhoodNumber}` : ''}`),
          fetch(`${API_BASE_URL}/trend?${baseQuery}`),
          fetch(`${API_BASE_URL}/extremes?${baseQuery}`),
          fetch(`${API_BASE_URL}/forecast?start_year=${filters.startYear}&end_year=${filters.endYear}${filters.neighborhoodNumber ? `&neighborhood_number=${filters.neighborhoodNumber}` : ''}`),
          fetch(`${API_BASE_URL}/forecast-trend?start_year=${filters.startYear}&end_year=${filters.endYear}${filters.neighborhoodNumber ? `&neighborhood_number=${filters.neighborhoodNumber}` : ''}`),
        ])
        const [kpiPayload, summaryPayload, trendPayload, extremesPayload, forecastPayload, forecastTrendPayload] = await Promise.all([
          kpiResponse.json(),
          summaryResponse.json(),
          trendResponse.json(),
          extremesResponse.json(),
          forecastResponse.json(),
          forecastTrendResponse.json(),
        ])
        setKpis(kpiPayload)
        setSummaryRows(summaryPayload)
        setTrendRows(trendPayload)
        setExtremes(extremesPayload)
        setForecastRows(forecastPayload)
        setForecastTrendRows(forecastTrendPayload)
        if (selectedCategory && filters.neighborhoodNumber && selectedCategoryYear) {
          const categoryTrendResponse = await fetch(`${API_BASE_URL}/category-count-trend?category=${encodeURIComponent(selectedCategory)}&start_year=${selectedCategoryYear}&end_year=${selectedCategoryYear}&neighborhood_number=${filters.neighborhoodNumber}`)
          const categoryTrendPayload = await categoryTrendResponse.json()
          setCategoryTrendRows(categoryTrendPayload)
        } else {
          setCategoryTrendRows([])
        }
      } catch (error) {
        setErrorMessage('Failed to query dashboard endpoints.')
      } finally {
        setIsLoading(false)
      }
    }

    loadDashboardData()
  }, [baseQuery, filters.endYear, filters.startYear, filters.neighborhoodNumber, selectedCategory, selectedCategoryYear])

  useEffect(() => {
    async function loadMapData() {
      if (!mapYear) return
      try {
        const mapQuery = mapYear === 'all' ? '' : `?year=${mapYear}`
        const response = await fetch(`${API_BASE_URL}/map-hotspots${mapQuery}`)
        const payload = await response.json()
        setMapMonths(payload.months || [])
        setMapRows(payload.rows || [])
        setMapMonthIndex(0)
      } catch (error) {
        setErrorMessage('Failed to load map hotspot data.')
      }
    }
    loadMapData()
  }, [mapYear])

  useEffect(() => {
    if (!isMapPlaying || mapMonths.length <= 1) return undefined
    const timer = setInterval(() => {
      setMapMonthIndex((previous) => (previous + 1) % mapMonths.length)
    }, 900)
    return () => clearInterval(timer)
  }, [isMapPlaying, mapMonths.length])

  function updateFilter(key, value) {
    setFilters((previous) => ({ ...previous, [key]: value }))
  }

  const selectedMapMonth = mapMonths[mapMonthIndex] || null
  const selectedMapRows = useMemo(
    () => mapRows.filter((row) => row.month_start === selectedMapMonth),
    [mapRows, selectedMapMonth],
  )

  return (
    <main className="dashboard">
      <header className="dashboard-header">
        <h1>Datamining & Machine Learning Final Project</h1>
        <p>St. Paul Police Staffing Analysis</p>
      </header>

      <section className="tabs">
        <button type="button" className={activeTab === 'analytics' ? 'tab active' : 'tab'} onClick={() => setActiveTab('analytics')}>
          Analytics
        </button>
        <button type="button" className={activeTab === 'forecast' ? 'tab active' : 'tab'} onClick={() => setActiveTab('forecast')}>
          Forecast
        </button>
        <button type="button" className={activeTab === 'map' ? 'tab active' : 'tab'} onClick={() => setActiveTab('map')}>
          Spatial Map
        </button>
      </section>

      <section className="filters">
        <div className="filter-field">
          <label htmlFor="startYear">Start Year</label>
          <input id="startYear" type="number" value={filters.startYear} onChange={(event) => updateFilter('startYear', Number(event.target.value))} />
        </div>
        <div className="filter-field">
          <label htmlFor="endYear">End Year</label>
          <input id="endYear" type="number" value={filters.endYear} onChange={(event) => updateFilter('endYear', Number(event.target.value))} />
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

      {errorMessage ? <p className="error">{errorMessage}</p> : null}
      {isLoading ? <p className="loading">Loading dashboard data...</p> : null}

      {activeTab === 'analytics' ? (
        <>
      <section className="kpi-grid">
        <article className="kpi-card">
          <h2>Avg Actual Total</h2>
          <strong>{formatNumber(kpis?.avg_actual_total_count)}</strong>
        </article>
        <article className="kpi-card">
          <h2>Avg Predicted Total</h2>
          <strong>{formatNumber(kpis?.avg_predicted_total_count)}</strong>
        </article>
        <article className="kpi-card">
          <h2>Avg APE Total (%)</h2>
          <strong>{formatNumber(kpis?.avg_ape_total_pct, 2)}</strong>
        </article>
        <article className="kpi-card">
          <h2>Avg Staffing Score</h2>
          <strong>{formatNumber(kpis?.avg_staffing_strength_score, 2)}</strong>
        </article>
      </section>

      <section className="panel">
        <h2>Month Trend</h2>
        <TrendChart rows={trendRows} />
      </section>

      <section className="panel">
        <h2>Highest/Lowest Need Month</h2>
        <div className="extreme-grid">
          <div className="extreme-card">
            <h3>Highest Need</h3>
            <p className="extreme-date">{formatMonthYear(extremes?.highest_need_month?.month_start)}</p>
            <p className="extreme-neighborhood">{formatNeighborhoodDisplayName(extremes?.highest_need_month?.neighborhood_name)}</p>
            <p className="extreme-score">Score: {formatNumber(extremes?.highest_need_month?.staffing_strength_score_0_100, 2)}</p>
          </div>
          <div className="extreme-card">
            <h3>Lowest Need</h3>
            <p className="extreme-date">{formatMonthYear(extremes?.lowest_need_month?.month_start)}</p>
            <p className="extreme-neighborhood">{formatNeighborhoodDisplayName(extremes?.lowest_need_month?.neighborhood_name)}</p>
            <p className="extreme-score">Score: {formatNumber(extremes?.lowest_need_month?.staffing_strength_score_0_100, 2)}</p>
          </div>
        </div>
      </section>

      <section className="panel">
        <h2>Neighborhood Summary Table</h2>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Neighborhood</th>
                <th>Avg Actual</th>
                <th>Avg Predicted</th>
                <th>Avg APE %</th>
                <th>Avg Staffing Score</th>
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
      </section>
      <section className="panel">
        <h2>Category Actual vs Predicted Counts</h2>
        <div className="filter-field category-inline">
          <label htmlFor="categoryCompare">Category</label>
          <select id="categoryCompare" value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)}>
            <option value="">All categories (no category table)</option>
            {availableFilters.categories.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </div>
        <div className="filter-field category-inline">
          <label htmlFor="categoryYear">Category Year</label>
          <select id="categoryYear" value={selectedCategoryYear} onChange={(event) => setSelectedCategoryYear(event.target.value)}>
            {availableFilters.years.map((yearValue) => (
              <option key={yearValue} value={String(yearValue)}>{yearValue}</option>
            ))}
          </select>
        </div>
        {selectedCategory && !filters.neighborhoodNumber ? (
          <p className="subtle">Select a neighborhood at the top to view category counts.</p>
        ) : null}
        {selectedCategory && filters.neighborhoodNumber ? (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Actual Count</th>
                  <th>Predicted Count</th>
                  <th>Difference (Actual - Predicted)</th>
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
        ) : (
          <p className="subtle">Select a category to show month-by-month actual and predicted counts.</p>
        )}
      </section>
      <section className="panel">
        <details>
          <summary className="guide-summary">Analytics Guide</summary>
          <div className="guide-grid">
          <article>
            <h3>What APE means</h3>
            <p>APE is the absolute percent error for total crime count at each neighborhood-month: |actual - predicted| / actual * 100.</p>
          </article>
          <article>
            <h3>What Category WAPE means</h3>
            <p>Category WAPE is weighted error across category counts: sum(|actual - predicted|) / sum(actual) * 100. Values over 100% mean the total miss is larger than the observed counts.</p>
          </article>
          <article>
            <h3>What Normalized Category Error means</h3>
            <p>Normalized Category Error scales category absolute error by predicted total count: sum(|actual - predicted|) / sum(predicted total) * 100. Use this when you want category error on the same denominator style as total predicted workload.</p>
          </article>
          <article>
            <h3>How staffing score is used</h3>
            <p>The staffing strength score (0-100) is your composite demand signal from predicted crime mix and policy weights. Higher score means comparatively higher staffing pressure for that month and neighborhood.</p>
          </article>
          </div>
        </details>
      </section>
      </>
      ) : activeTab === 'forecast' ? (
      <section className="panel">
        <h2>Forecast Results</h2>
        <p className="subtle">Frozen forecast table filtered by current year range and neighborhood.</p>
        <ForecastTrendChart rows={forecastTrendRows} />
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Month</th>
                <th>Neighborhood</th>
                <th>Pred Total</th>
                <th>Violent</th>
                <th>Weapons</th>
                <th>Theft</th>
                <th>Damage</th>
                <th>Narcotics</th>
                <th>Proactive Visits</th>
                <th>Other</th>
                <th>Staffing Score</th>
              </tr>
            </thead>
            <tbody>
              {forecastRows.map((row) => (
                <tr key={`${row.month_start}-${row.neighborhood_number}`}>
                  <td>{formatMonthYear(row.month_start)}</td>
                  <td>{row.neighborhood_name}</td>
                  <td>{formatNumber(row.predict_crime_count, 2)}</td>
                  <td>{formatNumber(row.predict_violent_person_count, 2)}</td>
                  <td>{formatNumber(row.predict_weapons_count, 2)}</td>
                  <td>{formatNumber(row.predict_property_theft_count, 2)}</td>
                  <td>{formatNumber(row.predict_property_damage_count, 2)}</td>
                  <td>{formatNumber(row.predict_narcotic_count, 2)}</td>
                  <td>{formatNumber(row.predict_proactive_police_visits_count, 2)}</td>
                  <td>{formatNumber(row.predict_other_count, 2)}</td>
                  <td>{formatNumber(row.staffing_strength_score_0_100, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      ) : (
      <section className="panel">
        <h2>Crime Hotspot Timelapse Map</h2>
        <p className="subtle">Month-by-month hotspot intensity by neighborhood. Use play for timelapse.</p>
        <div className="map-controls">
          <div className="filter-field map-field">
            <label htmlFor="mapYear">Map Year</label>
            <select id="mapYear" value={mapYear} onChange={(event) => setMapYear(event.target.value)}>
              <option value="all">All Years (2014-2026)</option>
              {availableFilters.years.map((yearValue) => (
                <option key={yearValue} value={String(yearValue)}>{yearValue}</option>
              ))}
            </select>
          </div>
          <button type="button" className="play-button" onClick={() => setIsMapPlaying((previous) => !previous)}>
            {isMapPlaying ? 'Pause Timelapse' : 'Play Timelapse'}
          </button>
        </div>
        <div className="month-scrubber">
          <input
            type="range"
            min={0}
            max={Math.max(0, mapMonths.length - 1)}
            value={mapMonthIndex}
            onChange={(event) => setMapMonthIndex(Number(event.target.value))}
          />
          <span>{selectedMapMonth || 'No month selected'}</span>
        </div>
        <HotspotMap monthRows={selectedMapRows} monthLabel={selectedMapMonth} />
      </section>
      )}
    </main>
  )
}

export default App
