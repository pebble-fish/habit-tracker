<script>
  export let title = ''
  export let unit = ''
  export let goal = 1
  export let entries = []
  export let highlightUserId = ''
  export let startDateKey = '2026-04-21'

  const CHART = {
    left: 68,
    right: 860,
    top: 20,
    bottom: 252,
  }

  const DEFAULT_BLUE = '#2f6fa3'

  $: chartStartDate = parseDateKey(startDateKey)
  $: today = stripTime(new Date())
  $: maxEntryDate = entries.reduce((currentMax, entry) => {
    const entryDate = parseDateKey(entry.dateKey)
    return entryDate > currentMax ? entryDate : currentMax
  }, chartStartDate)
  $: chartEndDate = maxDate(maxDate(today, chartStartDate), maxEntryDate)
  $: totalDays = diffInDays(chartStartDate, chartEndDate) + 1

  $: values = entries.map((entry) => Number(entry.value) || 0)
  $: maxValue = Math.max(goal, ...values, 1)
  $: scaleMax = niceCeiling(maxValue)
  $: yTicks = [0, scaleMax * 0.25, scaleMax * 0.5, scaleMax * 0.75, scaleMax]
  $: xTickKeys = buildDateTicks(chartStartDate, chartEndDate)
  $: goalY = yFor(goal)
  $: lineSeries = groupEntriesByUser(entries)

  function parseDateKey(dateKey) {
    const [year, month, day] = dateKey.split('-').map(Number)
    return new Date(year, (month ?? 1) - 1, day ?? 1)
  }

  function stripTime(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate())
  }

  function maxDate(a, b) {
    return a.getTime() >= b.getTime() ? a : b
  }

  function formatDateKey(date) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  function diffInDays(start, end) {
    const msPerDay = 1000 * 60 * 60 * 24
    return Math.round((stripTime(end).getTime() - stripTime(start).getTime()) / msPerDay)
  }

  function niceCeiling(value) {
    if (value <= 2) {
      return Math.ceil(value * 2) / 2
    }

    const base = 10 ** Math.floor(Math.log10(value))
    const scaled = value / base

    if (scaled <= 1) return base
    if (scaled <= 2) return 2 * base
    if (scaled <= 5) return 5 * base
    return 10 * base
  }

  function xForDate(dateKey) {
    if (totalDays <= 1) {
      return (CHART.left + CHART.right) / 2
    }

    const daysFromStart = diffInDays(chartStartDate, parseDateKey(dateKey))
    const clamped = Math.min(totalDays - 1, Math.max(0, daysFromStart))
    return CHART.left + (clamped * (CHART.right - CHART.left)) / (totalDays - 1)
  }

  function yFor(value) {
    if (scaleMax === 0) return CHART.bottom
    return CHART.bottom - (Math.max(0, value) / scaleMax) * (CHART.bottom - CHART.top)
  }

  function buildDateTicks(startDate, endDate) {
    const dayCount = diffInDays(startDate, endDate) + 1
    const step = dayCount <= 7 ? 1 : Math.ceil(dayCount / 6)
    const ticks = []

    for (let index = 0; index < dayCount; index += step) {
      const tickDate = new Date(startDate)
      tickDate.setDate(startDate.getDate() + index)
      ticks.push(formatDateKey(tickDate))
    }

    const endKey = formatDateKey(endDate)
    if (ticks[ticks.length - 1] !== endKey) {
      ticks.push(endKey)
    }

    return ticks
  }

  function formatYTick(value) {
    if (unit === 'ml') return `${Math.round(value)}`
    if (unit === 'oz') return value.toFixed(1)
    return value.toFixed(1)
  }

  function formatPointValue(value) {
    if (unit === 'ml') return `${Math.round(value)} ml`
    if (unit === 'oz') return `${value.toFixed(1)} oz`
    return `${value.toFixed(2)} h`
  }

  function formatXAxis(dateKey) {
    return parseDateKey(dateKey).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    })
  }

  function compareDateKey(a, b) {
    if (a < b) return -1
    if (a > b) return 1
    return 0
  }

  function groupEntriesByUser(seriesEntries) {
    const map = new Map()

    for (const entry of seriesEntries) {
      if (!map.has(entry.userId)) {
        map.set(entry.userId, {
          userId: entry.userId,
          username: entry.username,
          userColor: entry.userColor,
          entries: [],
        })
      }
      map.get(entry.userId).entries.push(entry)
    }

    for (const group of map.values()) {
      group.entries.sort((a, b) => compareDateKey(a.dateKey, b.dateKey))
    }

    return [...map.values()].sort((a, b) => a.username.localeCompare(b.username))
  }

  function linePointsFor(seriesEntries) {
    return seriesEntries.map((entry) => `${xForDate(entry.dateKey)},${yFor(entry.value)}`).join(' ')
  }

  function colorForEntry(userColor) {
    return userColor || DEFAULT_BLUE
  }
</script>

<article class="graph-card">
  <header>
    <h3>{title}</h3>
  </header>

  <svg viewBox="0 0 900 320" role="img" aria-label={`${title} timeline graph`}>
    {#each yTicks as tick}
      {@const y = yFor(tick)}
      <line class="grid" x1={CHART.left} y1={y} x2={CHART.right} y2={y} />
      <text class="axis" x={CHART.left - 10} y={y + 4}>{formatYTick(tick)}</text>
    {/each}

    {#each xTickKeys as dateKey}
      {@const x = xForDate(dateKey)}
      <line class="x-grid" x1={x} y1={CHART.top} x2={x} y2={CHART.bottom} />
      <text class="x-label" x={x} y={CHART.bottom + 18}>{formatXAxis(dateKey)}</text>
    {/each}

    <line class="goal" x1={CHART.left} y1={goalY} x2={CHART.right} y2={goalY} />
    <text class="goal-label" x={CHART.right - 8} y={goalY - 6}>Goal {formatYTick(goal)} {unit}</text>

    {#each lineSeries as series}
      {#if series.entries.length > 1}
        <polyline
          class="series-line"
          points={linePointsFor(series.entries)}
          stroke={colorForEntry(series.userColor)}
          opacity={series.userId === highlightUserId || !highlightUserId ? 0.9 : 0.35}
        />
      {/if}
    {/each}

    {#each entries as entry}
      {@const x = xForDate(entry.dateKey)}
      {@const y = yFor(entry.value)}
      {@const selected = entry.userId === highlightUserId}
      <circle
        class:selected
        cx={x}
        cy={y}
        r={selected ? 8 : 6}
        fill={colorForEntry(entry.userColor)}
        stroke={selected ? '#173b57' : '#ffffff'}
        stroke-width={selected ? 3 : 2}
        opacity={selected || !highlightUserId ? 1 : 0.5}
      />
      <text class="value" x={x} y={y - 12}>{formatPointValue(entry.value)}</text>
      <text class="name" x={x} y={y + 14}>{entry.username}</text>
    {/each}
  </svg>

  {#if entries.length === 0}
    <p class="empty">No {title.toLowerCase()} data yet. Add a log entry to plot the first point.</p>
  {/if}
</article>
