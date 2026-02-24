/**
 * Compute SVG chart layout from daily usage data.
 *
 * @param {Array<{ date: string, cost: number, shoulders_cost: number, calls?: number }>} data
 * @param {{ width: number, height: number, paddingLeft?: number, paddingBottom?: number, barGap?: number }} opts
 * @returns {{ bars: Array, yTicks: Array, gridlines: Array, xLabels: Array, plotArea: object }}
 */
export function computeChartLayout(data, opts = {}) {
  const {
    width = 360,
    height = 90,
    paddingLeft = 38,
    paddingBottom = 18,
    paddingTop = 6,
    barGap = 1.5,
  } = opts

  const plotW = width - paddingLeft - 2   // 2px right margin
  const plotH = height - paddingBottom - paddingTop
  const plotX = paddingLeft
  const plotY = paddingTop

  // Find max cost for scale
  const maxCost = data.reduce((m, d) => Math.max(m, d.cost || 0), 0)
  const niceMax = niceMaxValue(maxCost)

  // Y-axis ticks (3-5 ticks from 0 to niceMax)
  const tickCount = niceMax === 0 ? 1 : Math.min(4, Math.max(2, Math.ceil(niceMax / niceStep(niceMax)) + 1))
  const step = niceMax === 0 ? 1 : niceMax / (tickCount - 1)

  const yTicks = []
  const gridlines = []
  for (let i = 0; i < tickCount; i++) {
    const val = step * i
    const y = plotY + plotH - (plotH * (val / (niceMax || 1)))
    yTicks.push({
      value: val,
      label: formatDollar(val),
      x: paddingLeft - 4,
      y,
    })
    gridlines.push({
      x1: plotX,
      x2: plotX + plotW,
      y,
    })
  }

  // Bars
  const n = data.length || 1
  const totalGap = barGap * (n - 1)
  const barW = Math.max(1, (plotW - totalGap) / n)

  const bars = data.map((d, i) => {
    const x = plotX + i * (barW + barGap)
    const total = d.cost || 0
    const shoulders = d.shoulders_cost || 0
    const direct = Math.max(0, total - shoulders)

    const totalH = niceMax > 0 ? (total / niceMax) * plotH : 0
    const shouldersH = niceMax > 0 ? (shoulders / niceMax) * plotH : 0
    const directH = niceMax > 0 ? (direct / niceMax) * plotH : 0

    // Min visible height for non-zero values
    const minH = 2
    const sH = shoulders > 0 ? Math.max(minH, shouldersH) : 0
    const dH = direct > 0 ? Math.max(minH, directH) : 0

    const baseY = plotY + plotH

    return {
      date: d.date,
      x,
      width: barW,
      // Shoulders segment (bottom)
      shouldersY: baseY - sH,
      shouldersH: sH,
      // Direct segment (stacked on top of shoulders)
      directY: baseY - sH - dH,
      directH: dH,
      // Data for tooltip
      shouldersCost: shoulders,
      directCost: direct,
      totalCost: total,
      calls: d.calls || 0,
      isToday: d.isToday || false,
      dayNum: d.dayNum || 0,
    }
  })

  // X-axis labels — 1st, 7th, 14th, 21st, last
  const labelDays = new Set([1, 7, 14, 21, data.length])
  const xLabels = bars
    .filter(b => labelDays.has(b.dayNum))
    .map(b => ({
      text: String(b.dayNum),
      x: b.x + b.width / 2,
      y: plotY + plotH + 13,
      isToday: b.isToday,
    }))

  return {
    bars,
    yTicks,
    gridlines,
    xLabels,
    plotArea: { x: plotX, y: plotY, width: plotW, height: plotH },
    baseline: { x1: plotX, x2: plotX + plotW, y: plotY + plotH },
  }
}

/**
 * Round up to a "nice" chart maximum.
 * Produces values like 0.25, 0.50, 1.00, 2.50, 5.00, 10.00, etc.
 */
function niceMaxValue(max) {
  if (max <= 0) return 0
  if (max <= 0.10) return 0.10
  if (max <= 0.25) return 0.25
  if (max <= 0.50) return 0.50
  if (max <= 1.00) return 1.00

  // For larger values, round up to next nice number
  const magnitude = Math.pow(10, Math.floor(Math.log10(max)))
  const normalized = max / magnitude
  let nice
  if (normalized <= 1.5) nice = 1.5
  else if (normalized <= 2) nice = 2
  else if (normalized <= 2.5) nice = 2.5
  else if (normalized <= 5) nice = 5
  else nice = 10
  return nice * magnitude
}

/**
 * Get a nice step size for the given max value.
 */
function niceStep(max) {
  if (max <= 0.10) return 0.05
  if (max <= 0.25) return 0.05
  if (max <= 0.50) return 0.10
  if (max <= 1.00) return 0.25
  if (max <= 2.50) return 0.50
  if (max <= 5.00) return 1.00
  if (max <= 10.0) return 2.50
  // For larger, use magnitude-based stepping
  const mag = Math.pow(10, Math.floor(Math.log10(max)))
  return mag
}

/**
 * Format a dollar value for y-axis labels.
 * $0, $0.25, $1, $5, $10, etc.
 */
function formatDollar(val) {
  if (val === 0) return '$0'
  if (val < 1) return '$' + val.toFixed(2)
  if (val < 10) return '$' + val.toFixed(val % 1 === 0 ? 0 : 2)
  return '$' + Math.round(val)
}
