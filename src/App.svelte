<script>
  import { onMount } from 'svelte'
  import { fade, fly } from 'svelte/transition'
  import { ArrowRight, Crosshair, MoveDown, Dices } from 'lucide-svelte'
  import GravityMode from './GravityMode.svelte'
  import RouletteMode from './RouletteMode.svelte'
  import ModeInfo from './ModeInfo.svelte'
  import GunMode from './GunMode.svelte'

  let page = $state('menu')
  let mode = $state('gun')
  let dailyMode = $state(readDailyPreference())
  let difficulty = $state(readDifficultyPreference())
  let dailyCountdown = $state('00:00:00')

  function readDailyPreference() {
    try {
      return window.localStorage.getItem('stupid-wordle-daily') === 'true'
    } catch {
      return false
    }
  }

  function readDifficultyPreference() {
    try {
      return window.localStorage.getItem('stupid-wordle-difficulty') === 'hard' ? 'hard' : 'normal'
    } catch {
      return 'normal'
    }
  }

  function updateDailyCountdown() {
    const now = new Date()
    const nextDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
    const secondsLeft = Math.max(0, Math.ceil((nextDay - now.getTime()) / 1000))
    const hours = String(Math.floor(secondsLeft / 3600)).padStart(2, '0')
    const minutes = String(Math.floor((secondsLeft % 3600) / 60)).padStart(2, '0')
    const seconds = String(secondsLeft % 60).padStart(2, '0')
    dailyCountdown = `${hours}:${minutes}:${seconds}`
  }

  function saveDailyPreference(event) {
    dailyMode = event.currentTarget.checked
    try {
      window.localStorage.setItem('stupid-wordle-daily', String(dailyMode))
    } catch {}
  }

  function saveDifficultyPreference(event) {
    difficulty = event.currentTarget.value === 'hard' ? 'hard' : 'normal'
    try {
      window.localStorage.setItem('stupid-wordle-difficulty', difficulty)
    } catch {}
  }

  onMount(() => {
    updateDailyCountdown()
    const timer = setInterval(updateDailyCountdown, 1000)
    return () => clearInterval(timer)
  })

  function openGame() {
    mode = 'gun'
    page = 'game'
  }

  function openGravity() {
    mode = 'gravity'
    page = 'game'
  }

  function openRoulette() {
    mode = 'roulette'
    page = 'game'
  }

</script>

<svelte:head>
  <title>Stupid Wordle</title>
</svelte:head>

<main class="app-shell" class:roulette-shell={page === 'game' && mode === 'roulette'}>
  {#if page === 'menu'}
    <div class="screen-view" in:fly={{ y: 10, duration: 220 }} out:fade={{ duration: 130 }}>
    <header class="masthead">
      <a class="brand" href="./" aria-label="Stupid Wordle home">STUPID WORDLE</a>
      {#if dailyMode}<span class="menu-daily-countdown">{dailyCountdown} until next word</span>{/if}
    </header>
    <section class="wordle-list" aria-labelledby="wordle-list-title">
      <h1 id="wordle-list-title">Variants</h1>
      <label class="daily-setting">
        <span class="daily-setting-copy"><strong>Daily word</strong><small>One word each day.</small></span>
        <input type="checkbox" role="switch" aria-label="Daily word mode" checked={dailyMode} onchange={saveDailyPreference} />
      </label>
      <label class="difficulty-setting">
        <span class="daily-setting-copy"><strong>Difficulty</strong><small>Choose the answer word list.</small></span>
        <select value={difficulty} aria-label="Difficulty" onchange={saveDifficultyPreference}>
          <option value="normal">Normal</option>
          <option value="hard">Hard</option>
        </select>
      </label>
      <div class="mode-card" in:fly={{ y: 8, duration: 180, delay: 40 }}>
        <button class="mode-card-select" type="button" onclick={openGame}>
          <span class="mode-icon"><Crosshair size={21} strokeWidth={1.8} /></span>
          <span class="mode-copy"><strong>Wordle, but I have a Gun</strong><small>Get greens, acquire ammo, shoot to reveal</small></span>
        </button>
        <ModeInfo mode="gun" />
        <ArrowRight class="mode-arrow" size={18} strokeWidth={1.8} />
      </div>
      <div class="mode-card gravity-mode-card" in:fly={{ y: 8, duration: 180, delay: 85 }}>
        <button class="mode-card-select" type="button" onclick={openGravity}>
          <span class="mode-icon gravity-mode-icon"><MoveDown size={21} strokeWidth={1.8} /></span>
          <span class="mode-copy"><strong>Wordle, but gravity was just invented</strong><small>Letters fall around with realistic-ish physics.</small></span>
        </button>
        <ModeInfo mode="gravity" />
        <ArrowRight class="mode-arrow" size={18} strokeWidth={1.8} />
      </div>
      <div class="mode-card roulette-mode-card" in:fly={{ y: 8, duration: 180, delay: 130 }}>
        <button class="mode-card-select" type="button" onclick={openRoulette}>
          <span class="mode-icon roulette-mode-icon"><Dices size={21} strokeWidth={1.8} /></span>
          <span class="mode-copy"><strong>Wordle, but it's Russian Roulette</strong><small>Every guess costs a letter, win it back in a mini Wordle</small></span>
        </button>
        <ModeInfo mode="roulette" />
        <ArrowRight class="mode-arrow" size={18} strokeWidth={1.8} />
      </div>
    </section>
    </div>
  {:else if mode === 'gravity'}
    <div class="screen-view" in:fly={{ x: 14, duration: 220 }} out:fly={{ x: -10, duration: 150 }}>
      <GravityMode onback={() => page = 'menu'} {dailyMode} {dailyCountdown} {difficulty} />
    </div>
  {:else if mode === 'roulette'}
    <div class="screen-view" in:fly={{ x: 14, duration: 220 }} out:fly={{ x: -10, duration: 150 }}>
      <RouletteMode onback={() => page = 'menu'} {dailyMode} {dailyCountdown} {difficulty} />
    </div>
  {:else}
    <div class="screen-view" in:fly={{ x: 14, duration: 220 }} out:fly={{ x: -10, duration: 150 }}>
      <GunMode onback={() => page = 'menu'} active={page === 'game' && mode === 'gun'} {dailyMode} {dailyCountdown} {difficulty} />
    </div>
  {/if}
  <footer class="site-footer">made by <a href="https://gen1xlol.github.io/" target="_blank" rel="noopener noreferrer">gen1x</a>, 2026</footer>
</main>
