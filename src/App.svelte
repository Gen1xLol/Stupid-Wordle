<script>
  import { getRandomWord, isAllowedWord } from './wordPicker.js'
  import { ArrowLeft, ArrowRight, Crosshair, Delete, MoveDown, Dices } from 'lucide-svelte'
  import GravityMode from './GravityMode.svelte'
  import RouletteMode from './RouletteMode.svelte'

  const wordLength = 8
  const maxGuesses = 6
  const keyboardRows = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm']
  let answer = $state('')
  let guesses = $state([])
  let currentGuess = $state('')
  let revealed = $state({})
  let solvedPositions = $state(Array(wordLength).fill(false))
  let keyboardState = $state({})
  let ammo = $state(0)
  let gameState = $state('loading')
  let notice = $state('')
  let checkingGuess = $state(false)
  let page = $state('menu')
  let mode = $state('gun')

  function evaluateGuess(guess) {
    const result = Array(wordLength).fill('absent')
    const remaining = {}
    for (let index = 0; index < wordLength; index += 1) {
      if (guess[index] === answer[index]) result[index] = 'correct'
      else remaining[answer[index]] = (remaining[answer[index]] ?? 0) + 1
    }
    for (let index = 0; index < wordLength; index += 1) {
      if (result[index] === 'correct') continue
      if (remaining[guess[index]] > 0) {
        result[index] = 'present'
        remaining[guess[index]] -= 1
      }
    }
    return result
  }

  function getTileState(guess, index) {
    return evaluateGuess(guess)[index]
  }

  function updateKeyboard(guess) {
    const nextState = { ...keyboardState }
    const results = evaluateGuess(guess)
    const rank = { absent: 1, present: 2, correct: 3 }
    for (let index = 0; index < guess.length; index += 1) {
      const letter = guess[index]
      const result = results[index]
      if (!nextState[letter] || rank[result] > rank[nextState[letter]]) nextState[letter] = result
    }
    keyboardState = nextState
  }

  async function startGame() {
    gameState = 'loading'
    notice = ''
    guesses = []
    currentGuess = ''
    revealed = {}
    solvedPositions = Array(wordLength).fill(false)
    keyboardState = {}
    ammo = 0
    checkingGuess = false
    try {
      answer = await getRandomWord(wordLength)
      gameState = 'playing'
    } catch {
      gameState = 'error'
      notice = 'The word list could not be loaded. Refresh to try again.'
    }
  }

  function openGame() {
    mode = 'gun'
    page = 'game'
    startGame()
  }

  function openGravity() {
    mode = 'gravity'
    page = 'game'
  }

  function openRoulette() {
    mode = 'roulette'
    page = 'game'
  }

  async function submitGuess() {
    if (gameState !== 'playing' || checkingGuess) return
    if (currentGuess.length !== wordLength) {
      notice = `Your guess needs ${wordLength} letters.`
      return
    }
    checkingGuess = true
    const isValid = await isAllowedWord(currentGuess)
    checkingGuess = false
    if (gameState !== 'playing') return
    if (!isValid) {
      notice = 'That word is not in the dictionary.'
      return
    }

    const guess = currentGuess
    const evaluation = evaluateGuess(guess)
    const nextSolvedPositions = [...solvedPositions]
    let earned = 0
    evaluation.forEach((result, index) => {
      if (result === 'correct' && !nextSolvedPositions[index]) {
        nextSolvedPositions[index] = true
        earned += 1
      }
    })
    solvedPositions = nextSolvedPositions
    guesses = [...guesses, guess]
    currentGuess = ''
    ammo += earned
    notice = earned ? `Bullseye. +${earned} ${earned === 1 ? 'bullet' : 'bullets'}.` : 'No new hits. Keep aiming.'
    updateKeyboard(guess)

    if (guess === answer) {
      gameState = 'won'
      notice = 'Target acquired. You got it.'
    } else if (guesses.length >= maxGuesses) {
      gameState = 'lost'
      notice = `Out of guesses. The word was ${answer.toUpperCase()}.`
    }
  }

  function handleKey(key) {
    if (gameState !== 'playing' || checkingGuess) return
    notice = ''
    if (key === 'Enter') {
      submitGuess()
    } else if (key === 'Backspace') {
      currentGuess = currentGuess.slice(0, -1)
    } else if (/^[a-z]$/i.test(key) && currentGuess.length < wordLength) {
      currentGuess += key.toLowerCase()
    }
  }

  function handleKeydown(event) {
    if (page !== 'game' || mode !== 'gun') return
    if (event.metaKey || event.ctrlKey || event.altKey) return
    if (/^[a-z]$/i.test(event.key) || event.key === 'Enter' || event.key === 'Backspace') {
      event.preventDefault()
      handleKey(event.key)
    }
  }

  function fireAt(index) {
    if (gameState !== 'playing' || ammo < 1 || revealed[index] || solvedPositions[index]) return
    revealed = { ...revealed, [index]: true }
    ammo -= 1
    notice = `Shot ${index + 1}: ${answer[index].toUpperCase()}.`
  }

</script>

<svelte:window onkeydown={handleKeydown} />

<svelte:head>
  <title>Stupid Wordle</title>
  <meta name="description" content="Eight letters. Six guesses. Earn bullets with exact hits and shoot to reveal letters." />
</svelte:head>

<main class="app-shell" class:roulette-shell={mode === 'roulette'}>
  {#if page === 'menu'}
    <header class="masthead">
      <a class="brand" href="./" aria-label="Stupid Wordle home">STUPID WORDLE</a>
    </header>
    <section class="wordle-list" aria-labelledby="wordle-list-title">
      <h1 id="wordle-list-title">Variants</h1>
      <button class="mode-card" type="button" onclick={openGame}>
        <span class="mode-icon"><Crosshair size={21} strokeWidth={1.8} /></span>
        <span class="mode-copy"><strong>Wordle, but I have a Gun</strong><small>8 letters - get greens, acquire ammo, shoot to reveal</small></span>
        <ArrowRight class="mode-arrow" size={18} strokeWidth={1.8} />
      </button>
      <button class="mode-card gravity-mode-card" type="button" onclick={openGravity}>
        <span class="mode-icon gravity-mode-icon"><MoveDown size={21} strokeWidth={1.8} /></span>
        <span class="mode-copy"><strong>Wordle, but gravity was just invented</strong><small>Letters fall, wobble, and bump around. Shake to line them up.</small></span>
        <ArrowRight class="mode-arrow" size={18} strokeWidth={1.8} />
      </button>
      <button class="mode-card roulette-mode-card" type="button" onclick={openRoulette}>
        <span class="mode-icon roulette-mode-icon"><Dices size={21} strokeWidth={1.8} /></span>
        <span class="mode-copy"><strong>Wordle, but it's Russian Roulette</strong><small>Every guess costs a letter. Win it back in a mini Wordle.</small></span>
        <ArrowRight class="mode-arrow" size={18} strokeWidth={1.8} />
      </button>
    </section>
  {:else if mode === 'gravity'}
    <GravityMode onback={() => page = 'menu'} />
  {:else if mode === 'roulette'}
    <RouletteMode onback={() => page = 'menu'} />
  {:else}
    <header class="game-header">
      <button class="back-button" type="button" aria-label="Back to variants" onclick={() => page = 'menu'}><ArrowLeft size={18} strokeWidth={1.8} /></button>
      <h1>Wordle, but I have a Gun</h1>
      <div class="ammo-badge" aria-live="polite"><Crosshair class="ammo-icon" size={18} strokeWidth={2} /><span class="ammo-count">{ammo}</span><span class="ammo-label">{ammo === 1 ? 'BULLET' : 'BULLETS'}</span></div>
    </header>
    <section class="game-panel" aria-label="Wordle, but I have a Gun">
      <div class="target-grid" aria-label="Secret word letter targets">
        {#each Array(wordLength) as _, index}
          <button
            class:revealed={revealed[index]}
            class:solved={solvedPositions[index]}
            class="target-tile"
            type="button"
            aria-label={solvedPositions[index] || revealed[index] ? `Position ${index + 1}: ${answer[index]}` : `Shoot position ${index + 1}`}
            disabled={gameState !== 'playing' || ammo < 1 || revealed[index] || solvedPositions[index]}
            onclick={() => fireAt(index)}
          >{solvedPositions[index] || revealed[index] ? answer[index].toUpperCase() : ''}</button>
        {/each}
      </div>
      <div class="guess-board" aria-label="Guess board">
        {#each Array(maxGuesses) as _, rowIndex}
          {@const guess = guesses[rowIndex] ?? (rowIndex === guesses.length ? currentGuess : '')}
          <div class="guess-row" class:submitted={rowIndex < guesses.length}>
            {#each Array(wordLength) as _, columnIndex}
              {@const value = guess[columnIndex] ?? ''}
              {@const tileState = rowIndex < guesses.length ? getTileState(guess, columnIndex) : ''}
              <div class="guess-tile" class:filled={value} class:correct={tileState === 'correct'} class:present={tileState === 'present'} class:absent={tileState === 'absent'} aria-label={value ? `Letter ${value}` : 'Empty'}>{value.toUpperCase()}</div>
            {/each}
          </div>
        {/each}
      </div>
      <div class="keyboard" aria-label="On-screen keyboard">
        {#each keyboardRows as row}
          <div class="keyboard-row">
            {#each [...row] as key}
              <button class="key" class:key-correct={keyboardState[key] === 'correct'} class:key-present={keyboardState[key] === 'present'} class:key-absent={keyboardState[key] === 'absent'} type="button" aria-label={key} onclick={() => handleKey(key)}>{key}</button>
            {/each}
          </div>
        {/each}
        <div class="keyboard-row last-row">
          <button class="key action-key" type="button" onclick={() => handleKey('Backspace')} aria-label="Backspace"><Delete size={17} strokeWidth={2} /></button>
          <button class="key enter-key" type="button" onclick={() => handleKey('Enter')}>ENTER</button>
        </div>
      </div>
      <div class="board-footer" aria-live="polite">
        <span class="notice">{notice || (gameState === 'loading' ? 'Loading…' : 'Type a word or use the keyboard.')}</span>
        {#if gameState === 'won' || gameState === 'lost'}
          <button class="play-again" type="button" onclick={startGame}>PLAY AGAIN</button>
        {/if}
      </div>
    </section>
  {/if}
  <footer class="site-footer">made by <a href="https://gen1xlol.github.io/" target="_blank" rel="noopener noreferrer">gen1x</a>, 2026</footer>
</main>
