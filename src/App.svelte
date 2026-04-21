<script>
  import CategoryGraph from './lib/CategoryGraph.svelte'

  const GOALS = {
    sleep: 8,
    water: 3000,
    exercise: 1,
    work: 8,
  }
  const ML_PER_OZ = 29.5735
  const BLUE_SHADES = ['#1f5e97', '#2f6fa3', '#3f80b0', '#5a98c6']

  const GRAPH_START_DATE_KEY = '2026-04-21'

  const METRICS = [
    { key: 'sleep', label: 'Sleep', unit: 'hours', goal: GOALS.sleep },
    { key: 'water', label: 'Water', unit: 'ml', goal: GOALS.water },
    { key: 'exercise', label: 'Exercise', unit: 'hours', goal: GOALS.exercise },
    { key: 'work', label: 'Work', unit: 'hours', goal: GOALS.work },
  ]

  let profiles = []
  let logs = []
  let nextProfileId = 1
  let nextLogId = 1

  let activeMetric = 'sleep'
  let leftPanelView = 'graph'
  let waterViewUnit = 'ml'
  let selectedUserId = ''
  let userError = ''
  let profileError = ''
  let logError = ''
  let saveNotice = ''

  let showAddProfile = false
  let newProfileName = ''
  let newProfileColor = BLUE_SHADES[1]

  let logForm = {
    category: 'sleep',
    start: defaultDateTime(-60),
    end: defaultDateTime(0),
    waterAmount: '',
    waterUnit: 'oz',
  }

  let activeGraphUnit = 'hours'
  let activeGraphGoal = GOALS.sleep
  let activeGraphEntries = []

  $: selectedProfile = profiles.find((profile) => profile.id === selectedUserId) ?? null
  $: {
    if (profiles.length > 0 && !profiles.some((profile) => profile.id === selectedUserId)) {
      selectedUserId = profiles[0].id
    }
  }
  $: sleepEntries = buildSeries('sleep', logs, profiles)
  $: waterEntries = buildSeries('water', logs, profiles)
  $: exerciseEntries = buildSeries('exercise', logs, profiles)
  $: workEntries = buildSeries('work', logs, profiles)
  $: activeMetricConfig = METRICS.find((metric) => metric.key === activeMetric) ?? METRICS[0]
  $: historyRows = buildHistoryRows(logs, profiles)

  $: {
    if (activeMetric === 'water') {
      activeGraphUnit = waterViewUnit
      activeGraphGoal = convertMlToDisplayUnit(GOALS.water)
      activeGraphEntries = convertWaterEntriesForDisplay(waterEntries)
    } else if (activeMetric === 'work') {
      activeGraphUnit = 'hours'
      activeGraphGoal = GOALS.work
      activeGraphEntries = workEntries
    } else if (activeMetric === 'exercise') {
      activeGraphUnit = 'hours'
      activeGraphGoal = GOALS.exercise
      activeGraphEntries = exerciseEntries
    } else {
      activeGraphUnit = 'hours'
      activeGraphGoal = GOALS.sleep
      activeGraphEntries = sleepEntries
    }
  }

  function formatDate(date) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  function formatDateTime(date) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day}T${hours}:${minutes}`
  }

  function defaultDateTime(offsetMinutes) {
    const now = new Date()
    now.setMinutes(now.getMinutes() + offsetMinutes)
    return formatDateTime(now)
  }

  function parseDateTimeLocal(value) {
    if (!value) return null
    const [datePart, timePart] = value.split('T')
    if (!datePart || !timePart) return null

    const [year, month, day] = datePart.split('-').map(Number)
    const [hours, minutes] = timePart.split(':').map(Number)

    if (
      !Number.isFinite(year) ||
      !Number.isFinite(month) ||
      !Number.isFinite(day) ||
      !Number.isFinite(hours) ||
      !Number.isFinite(minutes)
    ) {
      return null
    }

    return new Date(year, month - 1, day, hours, minutes, 0, 0)
  }

  function createProfile(username, color = BLUE_SHADES[1]) {
    const newProfile = {
      id: String(nextProfileId++),
      username,
      color,
    }
    profiles = [...profiles, newProfile]
    return newProfile
  }

  function toggleAddProfile() {
    showAddProfile = !showAddProfile
    profileError = ''
    if (showAddProfile) {
      newProfileColor = BLUE_SHADES[1]
    }
  }

  function addProfileFromPanel() {
    profileError = ''

    const username = newProfileName.trim()
    if (!username) {
      profileError = 'Enter a profile name first.'
      return
    }

    const duplicate = profiles.find((profile) => profile.username.toLowerCase() === username.toLowerCase())
    if (duplicate) {
      selectedUserId = duplicate.id
      newProfileName = ''
      showAddProfile = false
      return
    }

    const created = createProfile(username, newProfileColor)
    selectedUserId = created.id
    newProfileName = ''
    newProfileColor = BLUE_SHADES[1]
    showAddProfile = false
  }

  function ensureUserSelected() {
    if (profiles.length === 0) {
      userError = 'Add a profile with + first.'
      return ''
    }

    if (selectedUserId && profiles.some((profile) => profile.id === selectedUserId)) {
      return selectedUserId
    }

    userError = 'Choose an existing username from the list.'
    return ''
  }

  function addLog() {
    logError = ''
    userError = ''
    saveNotice = ''

    const userId = ensureUserSelected()
    if (!userId) {
      return
    }

    if (logForm.category === 'water') {
      const amount = Number(logForm.waterAmount)
      if (!Number.isFinite(amount) || amount <= 0) {
        logError = 'Enter a water amount greater than 0.'
        return
      }

      const amountMl = logForm.waterUnit === 'oz' ? amount * ML_PER_OZ : amount
      logs = [
        ...logs,
        {
          id: String(nextLogId++),
          userId: String(userId),
          category: 'water',
          dateKey: formatDate(new Date()),
          value: amountMl,
        },
      ]

      logForm = { ...logForm, waterAmount: '' }
      activeMetric = 'water'
      saveNotice = 'Water log saved.'
      return
    }

    if (!logForm.start || !logForm.end) {
      logError = 'Enter both start and end times.'
      return
    }

    const startDate = parseDateTimeLocal(logForm.start)
    const endDate = parseDateTimeLocal(logForm.end)
    if (!startDate || !endDate) {
      logError = 'Use valid start and end times.'
      return
    }

    const durationHours = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60)

    if (!Number.isFinite(durationHours) || durationHours <= 0) {
      logError = 'End time needs to be later than start time.'
      return
    }

    logs = [
      ...logs,
      {
        id: String(nextLogId++),
        userId: String(userId),
        category: logForm.category,
        dateKey: formatDate(endDate),
        value: durationHours,
      },
    ]

    activeMetric = logForm.category

    logForm = {
      ...logForm,
      start: defaultDateTime(-60),
      end: defaultDateTime(0),
    }
    saveNotice = `${logLabel(logForm.category)} log saved.`
  }

  function buildSeries(category, sourceLogs, sourceProfiles) {
    const usernameById = new Map(sourceProfiles.map((profile) => [profile.id, profile.username]))
    const colorById = new Map(sourceProfiles.map((profile) => [profile.id, profile.color ?? BLUE_SHADES[1]]))
    const totalsByDayAndUser = new Map()

    for (const log of sourceLogs) {
      if (log.category !== category) {
        continue
      }

      const normalizedUserId = String(log.userId)
      const key = `${log.dateKey}::${normalizedUserId}`
      totalsByDayAndUser.set(key, (totalsByDayAndUser.get(key) ?? 0) + log.value)
    }

    const result = []

    for (const [key, value] of totalsByDayAndUser.entries()) {
      const [dateKey, rawUserId] = key.split('::')
      const userId = String(rawUserId)
      const username = usernameById.get(userId) ?? `User ${userId}`
      const userColor = colorById.get(userId) ?? BLUE_SHADES[1]

      result.push({
        id: key,
        dateKey,
        userId,
        username,
        userColor,
        value,
      })
    }

    return result.sort((a, b) => {
      if (a.dateKey < b.dateKey) return -1
      if (a.dateKey > b.dateKey) return 1
      return a.username.localeCompare(b.username)
    })
  }

  function convertMlToDisplayUnit(valueInMl) {
    if (waterViewUnit === 'oz') {
      return valueInMl / ML_PER_OZ
    }
    return valueInMl
  }

  function convertWaterEntriesForDisplay(entries) {
    if (waterViewUnit === 'ml') {
      return entries
    }

    return entries.map((entry) => ({
      ...entry,
      value: entry.value / ML_PER_OZ,
    }))
  }

  function formatHoursShort(value) {
    const rounded = Math.round(value * 10) / 10
    if (Number.isInteger(rounded)) return `${rounded.toFixed(0)}h`
    return `${rounded.toFixed(1)}h`
  }

  function logLabel(category) {
    if (category === 'exercise') return 'Gym'
    if (category === 'work') return 'Work'
    if (category === 'water') return 'Water'
    return 'Sleep'
  }

  function buildHistoryRows(sourceLogs, sourceProfiles) {
    const usernameById = new Map(sourceProfiles.map((profile) => [profile.id, profile.username]))

    return sourceLogs
      .slice()
      .sort((a, b) => Number(b.id) - Number(a.id))
      .map((log) => {
        const typeOfLog = logLabel(log.category)
        const username = usernameById.get(String(log.userId)) ?? `User ${log.userId}`
        const amountLogged = log.category === 'water' ? `${Math.round(log.value)}ml` : formatHoursShort(log.value)
        return {
          id: log.id,
          typeOfLog,
          username,
          amountLogged,
        }
      })
  }
</script>

<main class="shell">
  <section class="workspace">
    <article class="graph-stage">
      <div class="graph-toolbar">
        <nav class="metric-nav" aria-label="Metric graph selector">
          {#each METRICS as metric}
            <button
              type="button"
              class:active={activeMetric === metric.key}
              class="metric-tab"
              on:click={() => (activeMetric = metric.key)}
            >
              {metric.label}
            </button>
          {/each}
        </nav>

        <div class="graph-toolbar-right">
          {#if leftPanelView === 'graph' && activeMetric === 'water'}
            <label class="view-unit">
              View as
              <select bind:value={waterViewUnit}>
                <option value="ml">ml</option>
                <option value="oz">oz</option>
              </select>
            </label>
          {/if}

          <nav class="view-nav" aria-label="Left panel view selector">
            <button
              type="button"
              class:active={leftPanelView === 'graph'}
              class="view-tab"
              on:click={() => (leftPanelView = 'graph')}
            >
              Graph View
            </button>
            <button
              type="button"
              class:active={leftPanelView === 'history'}
              class="view-tab"
              on:click={() => (leftPanelView = 'history')}
            >
              Logging History
            </button>
          </nav>
        </div>
      </div>

      {#if leftPanelView === 'graph'}

        {#key `${activeMetric}-${waterViewUnit}-${logs.length}-${profiles.length}`}
          <CategoryGraph
            title={activeMetricConfig.label}
            unit={activeGraphUnit}
            goal={activeGraphGoal}
            entries={activeGraphEntries}
            highlightUserId={selectedUserId}
            startDateKey={GRAPH_START_DATE_KEY}
          />
        {/key}
      {:else}
        <section class="history-view">
          {#if historyRows.length === 0}
            <p class="history-empty">No logs yet.</p>
          {:else}
            <table class="history-table">
              <thead>
                <tr>
                  <th>Type of Log</th>
                  <th>Username</th>
                  <th>Amt Logged</th>
                </tr>
              </thead>
              <tbody>
                {#each historyRows as row}
                  <tr>
                    <td>{row.typeOfLog}</td>
                    <td>{row.username}</td>
                    <td>{row.amountLogged}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          {/if}
        </section>
      {/if}
    </article>

    <aside class="card entry-panel">
      <div class="panel-head">
        <h2>Add Log Entry</h2>
        <button type="button" class="add-profile-btn" on:click={toggleAddProfile} aria-label="Add profile">
          +
        </button>
      </div>

      {#if showAddProfile}
        <div class="profile-create">
          <label for="new-profile-name">New Profile Name</label>
          <div class="profile-create-row">
            <input id="new-profile-name" type="text" bind:value={newProfileName} placeholder="Enter username" maxlength="24" />
            <button type="button" class="secondary-btn" on:click={addProfileFromPanel}>Add</button>
          </div>
          <fieldset class="color-palette">
            <legend>Dot Color</legend>
            <div class="color-options">
              {#each BLUE_SHADES as shade}
                <button
                  type="button"
                  class:active={newProfileColor === shade}
                  class="color-dot"
                  style={`--swatch:${shade}`}
                  on:click={() => (newProfileColor = shade)}
                  aria-label={`Choose color ${shade}`}
                ></button>
              {/each}
            </div>
          </fieldset>
          {#if profileError}
            <p class="error">{profileError}</p>
          {/if}
        </div>
      {/if}

      <form class="stack" on:submit|preventDefault={addLog}>
        <label for="username-select">Username</label>
        <select id="username-select" bind:value={selectedUserId}>
          <option value="">Select a user</option>
          {#each profiles as profile}
            <option value={profile.id}>{profile.username}</option>
          {/each}
        </select>

        {#if selectedProfile}
          <p class="selected-user">Logging for: <strong>{selectedProfile.username}</strong></p>
        {/if}

        {#if userError}
          <p class="error">{userError}</p>
        {/if}

        <label for="log-category">Category</label>
        <select id="log-category" bind:value={logForm.category}>
          <option value="sleep">Sleep</option>
          <option value="water">Water</option>
          <option value="exercise">Gym / Exercise</option>
          <option value="work">Work</option>
        </select>

        {#if logForm.category === 'water'}
          <label for="water-amount">Amount</label>
          <div class="row">
            <input id="water-amount" type="number" min="0" step="0.1" bind:value={logForm.waterAmount} />
            <select bind:value={logForm.waterUnit}>
              <option value="oz">oz</option>
              <option value="ml">ml</option>
            </select>
          </div>
        {:else}
          <label for="start-time">Start time</label>
          <input id="start-time" type="datetime-local" bind:value={logForm.start} />

          <label for="end-time">End time</label>
          <input id="end-time" type="datetime-local" bind:value={logForm.end} />
        {/if}

        <button type="submit" class="primary">Save Log</button>
        {#if logError}
          <p class="error">{logError}</p>
        {/if}
        {#if saveNotice}
          <p class="success">{saveNotice}</p>
        {/if}
      </form>
    </aside>
  </section>
</main>
