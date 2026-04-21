<script>
  export let title = ''
  export let unit = ''
  export let goal = 1
  export let points = []
  export let highlightUserId = ''

  const CHART = {
    left: 56,
    right: 752,
    top: 20,
    bottom: 210,
  }

  $: values = points.map((point) => Number(point.value) || 0)
  $: maxValue = Math.max(goal, ...values, 1)
  $: scaleMax = niceCeiling(maxValue)
  $: ticks = [0, scaleMax * 0.25, scaleMax * 0.5, scaleMax * 0.75, scaleMax]
  $: goalY = yFor(goal)

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

  function xFor(index, total) {
    if (total <= 1) {
      return (CHART.left + CHART.right) / 2
    }
    return CHART.left + (index * (CHART.right - CHART.left)) / (total - 1)
  }

  function yFor(value) {
    if (scaleMax === 0) return CHART.bottom
    return CHART.bottom - (Math.max(0, value) / scaleMax) * (CHART.bottom - CHART.top)
  }

  function formatTick(value) {
    if (unit === 'ml') return `${Math.round(value)}`
    return value.toFixed(1)
  }

  function formatPoint(value) {
    if (unit === 'ml') return `${Math.round(value)} ml`
    return `${value.toFixed(2)} h`
  }
</script>

<article class="graph-card">
  <header>
    <h3>{title}</h3>
    <p>Per user totals for selected day</p>
  </header>

  {#if points.length === 0}
    <p class="empty">Add profiles to draw this graph.</p>
  {:else}
    <svg viewBox="0 0 800 260" role="img" aria-label={`${title} comparison graph`}>
      {#each ticks as tick}
        {@const y = yFor(tick)}
        <line class="grid" x1={CHART.left} y1={y} x2={CHART.right} y2={y} />
        <text class="axis" x={CHART.left - 10} y={y + 4}>{formatTick(tick)}</text>
      {/each}

      <line class="goal" x1={CHART.left} y1={goalY} x2={CHART.right} y2={goalY} />
      <text class="goal-label" x={CHART.right - 8} y={goalY - 6}>Goal {formatTick(goal)} {unit}</text>

      {#each points as point, index}
        {@const x = xFor(index, points.length)}
        {@const y = yFor(point.value)}
        <circle class:selected={point.id === highlightUserId} cx={x} cy={y} r={point.id === highlightUserId ? 9 : 7} />
        <text class="value" x={x} y={y - 14}>{formatPoint(point.value)}</text>
        <text class="name" x={x} y={CHART.bottom + 24}>{point.username}</text>
      {/each}
    </svg>
  {/if}
</article>
