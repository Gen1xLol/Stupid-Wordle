<script>
  import { onMount } from 'svelte'
  import { ArrowLeft, Crosshair, Delete } from 'lucide-svelte'
  import { getRandomWord, getDailyWord, isAllowedWord } from './wordPicker.js'
  import ModeInfo from './ModeInfo.svelte'

  const wordLength = 8
  const maxGuesses = 6
  const keyboardRows = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm']
  let { onback, active = true, dailyMode = false, dailyCountdown = '', difficulty = 'normal' } = $props()
  let answer = $state('')
  let guesses = $state([])
  let currentGuess = $state('')
  let revealed = $state({})
  let solvedPositions = $state(Array(wordLength).fill(false))
  let keyboardState = $state({})
  let ammo = $state(0)
  let shotThisTurn = $state(false)
  let gameState = $state('loading')
  let notice = $state('')
  let checkingGuess = $state(false)

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
    shotThisTurn = false
    checkingGuess = false
    try {
      answer = await (dailyMode ? getDailyWord(wordLength, new Date(), difficulty) : getRandomWord(wordLength, difficulty))
      gameState = 'playing'
    } catch {
      gameState = 'error'
      notice = 'The word list could not be loaded. Refresh to try again.'
    }
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
    shotThisTurn = false
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
    if (!active) return
    if (event.metaKey || event.ctrlKey || event.altKey) return
    if (/^[a-z]$/i.test(event.key) || event.key === 'Enter' || event.key === 'Backspace') {
      event.preventDefault()
      handleKey(event.key)
    }
  }

  function fireAt(index) {
    if (gameState !== 'playing' || ammo < 1 || shotThisTurn || revealed[index] || solvedPositions[index]) return
    shotThisTurn = true
    revealed = { ...revealed, [index]: true }
    ammo = Math.max(0, ammo - 1)
    notice = `Shot ${index + 1}: ${answer[index].toUpperCase()}. ${ammo} ${ammo === 1 ? 'bullet' : 'bullets'} left.`
  }

  onMount(() => {
    startGame()
  })
</script>

<svelte:window onkeydown={handleKeydown} />

<header class="game-header gun-header">
  <button class="back-button" type="button" aria-label="Back to variants" onclick={onback}><ArrowLeft size={18} strokeWidth={1.8} /></button>
  <h1>Wordle, but I have a Gun{#if dailyMode}<small class="daily-header-countdown">{dailyCountdown} until next word</small>{/if}</h1>
  <ModeInfo mode="gun" />
  <div class="ammo-badge" aria-live="polite"><Crosshair class="ammo-icon" size={18} strokeWidth={2} /><span class="ammo-count">{ammo}</span><span class="ammo-label">{ammo === 1 ? 'BULLET' : 'BULLETS'}</span></div>
</header>

<section class="game-panel" aria-label="Wordle, but I have a Gun">
  <div class="target-grid" aria-label="Secret word letter targets">
    {#each Array(wordLength) as _, index}
      <button
        class:revealed={revealed[index]}
        class:solved={solvedPositions[index]}
        class:turn-locked={shotThisTurn && !revealed[index] && !solvedPositions[index]}
        class="target-tile"
        type="button"
        aria-label={solvedPositions[index] || revealed[index] ? `Position ${index + 1}: ${answer[index]}` : `Shoot position ${index + 1}`}
        disabled={gameState !== 'playing' || ammo < 1 || shotThisTurn || revealed[index] || solvedPositions[index]}
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
