import React, { useMemo, useRef, useState } from 'react'
import { formatDateLabel, formatNumber } from './formatters'

function ForecastTrendChart({ rows, chartAriaLabel = 'Forecasted crime count trend chart' }) {
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
        No forecast trend data for this date range and neighborhood. Try widening the year range or selecting All Neighborhoods.
      </p>
    )
  }

  const width = 980
  const height = 260
  const padding = 48
  const values = sampledRows.flatMap((row) => [
    Number(row.predicted_total_count),
    row.actual_total_count === null || row.actual_total_count === undefined ? 0 : Number(row.actual_total_count),
  ])
  const maxValue = Math.max(...values, 1)
  const yTicks = 5
  const stepX = sampledRows.length > 1 ? (width - padding * 2) / (sampledRows.length - 1) : 1
  const toY = (value) => height - padding - (Number(value) / maxValue) * (height - padding * 2)
  const pathData = sampledRows
    .map((row, index) => `${index === 0 ? 'M' : 'L'} ${padding + index * stepX} ${toY(row.predicted_total_count)}`)
    .join(' ')
  const actualPathRows = sampledRows
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
  sampledRows.forEach((row, index) => {
    const parsedDate = new Date(`${row.month_start}T00:00:00`)
    if (Number.isNaN(parsedDate.getTime())) return
    if ((parsedDate.getMonth() + 1) % 3 === 1 || sampledRows.length <= 12) {
      xTickIndexes.push(index)
    }
  })

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

  const hoveredRow = hoveredIndex !== null ? sampledRows[hoveredIndex] : null
  const hoveredX = hoveredIndex !== null ? padding + hoveredIndex * stepX : null
  const hoveredPredictedY = hoveredRow ? toY(hoveredRow.predicted_total_count) : null
  const hoveredActualY =
    hoveredRow && hoveredRow.actual_total_count !== null && hoveredRow.actual_total_count !== undefined
      ? toY(hoveredRow.actual_total_count)
      : null
  const hoveredRowHasActual =
    hoveredRow && hoveredRow.actual_total_count !== null && hoveredRow.actual_total_count !== undefined
  const tooltipOnLeft = hoveredIndex !== null ? hoveredIndex > sampledRows.length / 2 : false

  return (
    <div className="trend-wrapper">
      <h3 className="panel-chart-heading">Forecasted Crime Count Trend</h3>
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
            <g key={`forecast-y-${index}`}>
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
        {xTickIndexes.map((index) => {
          const xPosition = padding + index * stepX
          return (
            <g key={`forecast-x-${index}`}>
              <line x1={xPosition} y1={height - padding} x2={xPosition} y2={height - padding + 5} className="axis" />
              <text x={xPosition} y={height - padding + 20} className="axis-label axis-label-x">
                {formatDateLabel(sampledRows[index].month_start)}
              </text>
            </g>
          )
        })}
        {actualPathData ? <path d={actualPathData} className="forecast-actual-line" /> : null}
        <path d={pathData} className="forecast-line" />
        {hoveredRowHasActual ? (
          <g>
            <line x1={hoveredX} y1={padding} x2={hoveredX} y2={height - padding} className="hover-line" />
            <circle cx={hoveredX} cy={hoveredPredictedY} r="4" className="hover-dot forecast-dot" />
            {hoveredActualY !== null ? <circle cx={hoveredX} cy={hoveredActualY} r="4" className="hover-dot actual-dot" /> : null}
          </g>
        ) : null}
      </svg>
      {hoveredRowHasActual ? (
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
          <div>Predicted: {formatNumber(hoveredRow.predicted_total_count, 2)}</div>
          <div>Actual: {formatNumber(hoveredRow.actual_total_count, 2)}</div>
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
          <i className="legend-bar forecast" aria-hidden /> Predicted Crime Count
        </span>
      </div>
    </div>
  )
}

export default React.memo(ForecastTrendChart)
