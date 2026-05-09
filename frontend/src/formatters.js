export function formatNumber(value, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—'
  }
  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

export function formatDateLabel(value) {
  if (!value) return ''
  const normalizedDateString = String(value).split(' ')[0]
  const parsedDate = new Date(`${normalizedDateString}T00:00:00`)
  if (Number.isNaN(parsedDate.getTime())) return value
  return parsedDate.toLocaleDateString(undefined, { month: 'short', year: '2-digit' })
}

export function formatMonthYear(value) {
  if (!value) return 'N/A'
  const normalizedDateString = String(value).split(' ')[0]
  const parsedDate = new Date(`${normalizedDateString}T00:00:00`)
  if (Number.isNaN(parsedDate.getTime())) return value
  return parsedDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

export function formatQuarterLabel(value) {
  if (!value) return ''
  const normalizedDateString = String(value).split(' ')[0]
  const parsedDate = new Date(`${normalizedDateString}T00:00:00`)
  if (Number.isNaN(parsedDate.getTime())) return value
  const quarterNumber = Math.floor(parsedDate.getMonth() / 3) + 1
  const yearShort = String(parsedDate.getFullYear()).slice(-2)
  return `Q${quarterNumber} '${yearShort}`
}

export function formatNeighborhoodDisplayName(value) {
  if (!value) return 'N/A'
  return String(value).replace(/^\d+\s*-\s*/, '').trim()
}

export function toQueryString(filters) {
  const queryParameters = new URLSearchParams()
  queryParameters.set('start_year', filters.startYear)
  queryParameters.set('end_year', filters.endYear)
  if (filters.neighborhoodNumber) {
    queryParameters.set('neighborhood_number', filters.neighborhoodNumber)
  }
  return queryParameters.toString()
}
