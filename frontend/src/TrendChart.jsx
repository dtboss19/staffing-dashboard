import React, { useMemo, useRef, useState } from 'react'
import { formatDateLabel, formatNumber, formatQuarterLabel } from './formatters'

function downloadSVG(svgRef, filename) {
  const svg = svgRef.current
  if (!svg) return
  const serializer = new XMLSerializer()
  const blob = new Blob([serializer.serializeToString(svg)], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function TrendChart({
  rows,
  actualKey = 'actual_total_count',
  predictedKey = 'predicted_total_count',
  title = 'Monthly Actual vs Predicted Totals',
  chartAriaLabel = 'Line chart showing actual and predicted monthly crime counts',
}) {
  const originalRowCount = rows.length
  const sampledRows = useMemo(() => {
    if (rows.length <= 200) return rows
    const n = Math.ceil(rows.length / 120)
    const keep = []
    for (let i = 0; i < rows.length; i += n) keep.push(rows[i])
    if (keep[0] !== rows[0]) keep.unshift(rows[0])
    if (keep[keep.length - 1] !== rows[rows.length - 1]) keep.push(rows[rows.length - 1])
    return keep
  }, [rows])

  const svgReference = useRef(null)
  const [hoveredIndex, setHoveredIndex] = useState(null)

  if (!sampledRows.length) {
    return (
      <p className="empty-state">
        No trend data for this date range and neighborhood. Try widening the year range or selecting All Neighborhoods.
      </p>
    )
  }

  const width = 980
  const height = 280
  const padding = 48
  const values = sampledRows.flatMap((row) => [Number(row[actualKey]), Number(row[predictedKey])])
  const maxValue = Math.max(...values, 1)
  const yTicks = 5
  const stepX = sampledRows.length > 1 ? (width - padding * 2) / (sampledRows.length - 1) : 1
  const toY = (value) => height - padding - (Number(value) / maxValue) * (height - padding * 2)
  const parsedDates = sampledRows.map((row) => new Date(`${row.month_start}T00:00:00`))
  const isLongRange = sampledRows.length > 24
  const xTickIndexes = []
  parsedDates.forEach((dateValue, index) => {
    if (Number.isNaN(dateValue.getTime())) return
    const monthNumber = dateValue.getMonth() + 1
    if (isLongRange) {
      if (sampledRows.length > 72) {
        if (monthNumber === 1) xTickIndexes.push(index)
      } else if ([1, 4, 7, 10].includes(monthNumber)) {
        xTickIndexes.push(index)
      }
    } else if (sampledRows.length > 12) {
      if ([1, 4, 7, 10].includes(monthNumber)) xTickIndexes.push(index)
    } else {
      xTickIndexes.push(index)
    }
  })

  const actualPath = sampledRows
    .map((row, index) => `${index === 0 ? 'M' : 'L'} ${padding + index * stepX} ${toY(row[actualKey])}`)
    .join(' ')
  const predictedPath = sampledRows
    .map((row, index) => `${index === 0 ? 'M' : 'L'} ${padding + index * stepX} ${toY(row[predictedKey])}`)
    .join(' ')

  function handleMouseMove(event) {
    if (!svgReference.current || sampledRows.length < 2) return
    const box = svgReference.current.getBoundingClientRect()
    const relativeX = event.clientX - box.left
    const domainWidth = box.width - ((padding * 2 * box.width) / width)
    const paddingScaled = (padding * box.width) / width
    const unclampedIndex = Math.round(((relativeX - paddingScaled) / Math.max(domainWidth, 1)) * (sampledRows.length - 1))
    const clampedIndex = Math.max(0, Math.min(sampledRows.length - 1, unclampedIndex))
    setHoveredIndex(clampedIndex)
  }

  function apePercent(row) {
    if (row.ape_total_pct != null || row.avg_ape_total_pct != null) {
      return Number(row.ape_total_pct ?? row.avg_ape_total_pct)
    }
    const actual = Number(row[actualKey])
    const predicted = Number(row[predictedKey])
    if (!Number.isFinite(actual) || actual <= 0) return null
    return (Math.abs(actual - predicted) / actual) * 100
  }

  const hoveredRow = hoveredIndex !== null ? sampledRows[hoveredIndex] : null
  const hoveredX = hoveredIndex !== null ? padding + hoveredIndex * stepX : null
  const hoveredActualY = hoveredRow ? toY(hoveredRow[actualKey]) : null
  const hoveredPredictedY = hoveredRow ? toY(hoveredRow[predictedKey]) : null
  const tooltipOnLeft = hoveredIndex !== null ? hoveredIndex > sampledRows.length / 2 : false

  return (
    <div className="trend-wrapper">
      <div className="chart-heading-row">
        <h3 className="panel-chart-heading">{title}</h3>
        <button
          type="button"
          className="chart-download-btn"
          onClick={() => downloadSVG(svgReference, 'trend-chart.svg')}
          aria-label={`Download ${title} as SVG`}
        >
          ↓ SVG
        </button>
      </div>
      <svg
        ref={svgReference}
        className="trend-svg"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={chartAriaLabel}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredIndex(null)}
      >
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} className="axis" />
        <line x1={padding} y1={padding} x2={padding} y2={height - padding} className="axis" />
        <text x={padding - 32} y={height / 2} className="axis-title-y" transform={`rotate(-90 ${padding - 32},${height / 2})`}>
          Crime Count
        </text>
        <text x={(width + padding) / 2} y={height - 12} className="axis-title-x">
          Month
        </text>
        {Array.from({ length: yTicks + 1 }, (_, index) => {
          const yValue = (maxValue / yTicks) * (yTicks - index)
          const yPosition = padding + ((height - padding * 2) * index) / yTicks
          const isMajor = index === 0 || index === yTicks || index % 5 === 0
          return (
            <g key={`y-${index}`}>
              <line
                x1={padding}
                y1={yPosition}
                x2={width - padding}
                y2={yPosition}
                className={isMajor ? 'grid-line grid-line-major' : 'grid-line'}
              />
              <text x={padding - 10} y={yPosition + 4} className="axis-label axis-label-y">
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
                {isLongRange
                  ? formatQuarterLabel(sampledRows[rowIndex]?.month_start)
                  : formatDateLabel(sampledRows[rowIndex]?.month_start)}
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
      </svg>
      {hoveredRow ? (
        <div
          className={`chart-tooltip ${tooltipOnLeft ? 'chart-tooltip--left' : 'chart-tooltip--right'}`}
          style={{
            ...(tooltipOnLeft
              ? { right: `${100 - (hoveredIndex / Math.max(sampledRows.length - 1, 1)) * 100}%`, left: 'auto' }
              : { left: `${(hoveredIndex / Math.max(sampledRows.length - 1, 1)) * 100}%`, right: 'auto' }),
            transform: tooltipOnLeft ? 'translate(-8px,-50%)' : 'translate(8px,-50%)',
          }}
        >
          <div>{formatDateLabel(hoveredRow.month_start)}</div>
          <div>Actual: {formatNumber(hoveredRow[actualKey], 2)}</div>
          <div>Predicted: {formatNumber(hoveredRow[predictedKey], 2)}</div>
          {apePercent(hoveredRow) !== null ? <div>APE: {formatNumber(apePercent(hoveredRow), 2)}%</div> : null}
        </div>
      ) : null}
      {originalRowCount > sampledRows.length ? (
        <p className="subtle">Chart shows sampled view of {originalRowCount} data points</p>
      ) : null}
      <div className="trend-legend">
        <span>
          <i className="legend-bar actual" aria-hidden /> Actual Total Count
        </span>
        <span>
          <i className="legend-bar predicted" aria-hidden /> Predicted Total Count
        </span>
      </div>
    </div>
  )
}

export default React.memo(TrendChart)
