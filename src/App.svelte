<script>
  import CategoryGraph from './lib/CategoryGraph.svelte'

  const GOALS = {
    sleep: 8,
    water: 3000,
    exercise: 1,
  }

  let profiles = []
  let logs = []
  let nextProfileId = 1
  let nextLogId = 1

  let newUsername = ''
  let profileError = ''
  let logError = ''
  let selectedDate = formatDate(new Date())

  let logForm = {
    userId: '',
    category: 'sleep',
    start: defaultDateTime(-60),
    end: defaultDateTime(0),
    waterAmount: '',
    waterUnit: 'oz',
    waterDate: formatDate(new Date()),
  }

  $: selectedProfile = profiles.find((profile) => profile.id === logForm.userId)
  $: sleepPoints = buildPoints('sleep')
  $: waterPoints = buildPoints('water')
  $: exercisePoints = buildPoints('exercise')
  $: selectedDayLogs = logs
    .filter((entry) => entry.dateKey === selectedDate)
    .slice()
    .reverse()

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

  function addProfile() {
    const username = newUsername.trim()
    profileError = ''

    if (!username) {
      profileError = 'Enter a username before creating a profile.'
      return
    }

    const duplicate = profiles.some((profile) => profile.username.toLowerCase() === username.toLowerCase())

    if (duplicate) {
      profileError = 'That username already exists.'
      return
    }

    const newProfile = {
      id: String(nextProfileId++),
      username,
    }

    profiles = [...profiles, newProfile]
    newUsername = ''

    if (!logForm.userId) {
      logForm = { ...logForm, userId: newProfile.id }
    }
  }

  function addLog() {
    logError = ''

    if (!logForm.userId) {
      logError = 'Choose a user to log for.'
      return
    }

    if (logForm.category === 'water') {
      const amount = Number(logForm.waterAmount)
      if (!Number.isFinite(amount) || amount <= 0) {
        logError = 'Enter a water amount greater than 0.'
        return
      }

      const amountMl = logForm.waterUnit === 'oz' ? amount * 29.5735 : amount
      logs = [
        ...logs,
        {
          id: String(nextLogId++),
          userId: logForm.userId,
          category: 'water',
          dateKey: logForm.waterDate,
          value: amountMl,
          note: `${amount} ${logForm.waterUnit}`,
        },
      ]

      logForm = { ...logForm, waterAmount: '' }
      return
    }

    if (!logForm.start || !logForm.end) {
      logError = 'Enter both start and end times.'
      return
    }

    const startDate = new Date(logForm.start)
    const endDate = new Date(logForm.end)
    const durationHours = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60)

    if (!Number.isFinite(durationHours) || durationHours <= 0) {
      logError = 'End time needs to be later than start time.'
      return
    }

    logs = [
      ...logs,
      {
        id: String(nextLogId++),
        userId: logForm.userId,
        category: logForm.category,
        dateKey: formatDate(startDate),
        value: durationHours,
        note: `${logForm.start} -> ${logForm.end}`,
      },
    ]

    logForm = {
      ...logForm,
      start: defaultDateTime(-60),
      end: defaultDateTime(0),
    }
  }

  function buildPoints(category) {
    const totals = new Map(profiles.map((profile) => [profile.id, 0]))

    for (const log of logs) {
      if (log.category !== category || log.dateKey !== selectedDate) {
        continue
      }
      totals.set(log.userId, (totals.get(log.userId) ?? 0) + log.value)
    }

    return profiles.map((profile) => ({
      id: profile.id,
      username: profile.username,
      value: totals.get(profile.id) ?? 0,
    }))
  }

  function categoryTitle(category) {
    if (category === 'sleep') return 'Sleep'
    if (category === 'water') return 'Water'
    return 'Exercise'
  }

  function formatMetric(category, value) {
    if (category === 'water') {
      return `${Math.round(value)} ml (${(value / 29.5735).toFixed(1)} oz)`
    }
    return `${value.toFixed(2)} hours`
  }
</script>

<main class="shell">
  <header class="top">
    <p class="eyebrow">Daily Group Tracker</p>
    <h1>Log Sleep, Water, and Exercise</h1>
    <p class="subhead">Create a username, log entries, and compare everyone on a shared day-by-day graph.</p>
  </header>

  <section class="controls">
    <article class="card">
      <h2>Create Profile</h2>
      <form class="stack" on:submit|preventDefault={addProfile}>
        <label for="username">Username</label>
        <input
          id="username"
          type="text"
          bind:value={newUsername}
          placeholder="alex"
          autocomplete="off"
          maxlength="24"
        />
        <button type="submit">Add Profile</button>
        {#if profileError}
          <p class="error">{profileError}</p>
        {/if}
      </form>
      <ul class="chips">
        {#each profiles as profile}
          <li>{profile.username}</li>
        {/each}
      </ul>
      {#if profiles.length === 0}
        <p class="hint">No users yet. Add one to start logging.</p>
      {/if}
    </article>

    <article class="card">
      <h2>Add Log Entry</h2>
      {#if profiles.length === 0}
        <p class="hint">Create at least one profile first.</p>
      {:else}
        <form class="stack" on:submit|preventDefault={addLog}>
          <label for="log-user">User</label>
          <select id="log-user" bind:value={logForm.userId}>
            <option value="" disabled>Select a user</option>
            {#each profiles as profile}
              <option value={profile.id}>{profile.username}</option>
            {/each}
          </select>

          <label for="log-category">Category</label>
          <select id="log-category" bind:value={logForm.category}>
            <option value="sleep">Sleep</option>
            <option value="water">Water</option>
            <option value="exercise">Gym / Exercise</option>
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

            <label for="water-date">Date</label>
            <input id="water-date" type="date" bind:value={logForm.waterDate} />
          {:else}
            <label for="start-time">Start time</label>
            <input id="start-time" type="datetime-local" bind:value={logForm.start} />

            <label for="end-time">End time</label>
            <input id="end-time" type="datetime-local" bind:value={logForm.end} />
          {/if}

          <button type="submit">Save Log</button>
          {#if logError}
            <p class="error">{logError}</p>
          {/if}
        </form>
      {/if}
    </article>
  </section>

  <section class="date-row">
    <label for="selected-date">Comparison day</label>
    <input id="selected-date" type="date" bind:value={selectedDate} />
    {#if selectedProfile}
      <p class="selection">Highlighting: <strong>{selectedProfile.username}</strong></p>
    {/if}
  </section>

  <section class="graphs">
    <CategoryGraph
      title="Sleep"
      unit="hours"
      goal={GOALS.sleep}
      points={sleepPoints}
      highlightUserId={logForm.userId}
    />

    <CategoryGraph
      title="Water"
      unit="ml"
      goal={GOALS.water}
      points={waterPoints}
      highlightUserId={logForm.userId}
    />

    <CategoryGraph
      title="Exercise"
      unit="hours"
      goal={GOALS.exercise}
      points={exercisePoints}
      highlightUserId={logForm.userId}
    />
  </section>

  <section class="card log-list">
    <h2>Entries on {selectedDate}</h2>
    {#if selectedDayLogs.length === 0}
      <p class="hint">No entries yet for this date.</p>
    {:else}
      <ul>
        {#each selectedDayLogs as entry}
          <li>
            <strong>{profiles.find((profile) => profile.id === entry.userId)?.username ?? 'Unknown user'}</strong>
            <span>{categoryTitle(entry.category)}: {formatMetric(entry.category, entry.value)}</span>
          </li>
        {/each}
      </ul>
    {/if}
  </section>
</main>
