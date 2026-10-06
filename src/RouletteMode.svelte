<script>
  import { onMount, tick } from 'svelte'
  import { ArrowLeft, Delete, Dices } from 'lucide-svelte'
  import { getRandomWord, getDailyWord, getRandomRevivalWord, isAllowedWord } from './wordPicker.js'
  import ModeInfo from './ModeInfo.svelte'

  const wordLength = 8
  const miniLength = 4
  const miniMaxGuesses = 5
  const keyboardRows = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm']
  let { onback, dailyMode = false, dailyCountdown = '', difficulty = 'normal' } = $props()
  let answer = $state('')
  let guesses = $state([])
  let currentGuess = $state('')
  let disabledLetters = $state([])
  let gameState = $state('loading')
  let notice = $state('')
  let miniAnswer = $state('')
  let miniGuesses = $state([])
  let miniGuess = $state('')
  let miniState = $state('waiting')
  let miniNotice = $state('')
  let checkingGuess = $state(false)
  let checkingMini = $state(false)
  let activeBoard = $state('main')
  let historyElement

  function evaluateGuess(guess, target, length) {
    const result = Array(length).fill('absent')
    const remaining = {}
    for (let index = 0; index < length; index += 1) {
      if (guess[index] === target[index]) result[index] = 'correct'
      else remaining[target[index]] = (remaining[target[index]] ?? 0) + 1
    }
    for (let index = 0; index < length; index += 1) {
      if (result[index] === 'correct') continue
      if (remaining[guess[index]] > 0) {
        result[index] = 'present'
        remaining[guess[index]] -= 1
      }
    }
    return result
  }

  function getTileState(guess, target, length, index) {
    return evaluateGuess(guess, target, length)[index]
  }

  async function beginMini(letter) {
    miniState = 'loading'
    miniAnswer = ''
    miniGuess = ''
    miniGuesses = []
    miniNotice = ''
    try {
      miniAnswer = await getRandomRevivalWord(miniLength)
      miniState = 'playing'
      miniNotice = `Solve it in ${miniMaxGuesses} tries to revive ${letter.toUpperCase()}.`
    } catch {
      miniState = 'error'
      miniNotice = 'The mini word could not be loaded.'
    }
  }

  async function startGame() {
    gameState = 'loading'
    notice = ''
    guesses = []
    currentGuess = ''
    disabledLetters = []
    miniAnswer = ''
    miniGuesses = []
    miniGuess = ''
    miniState = 'waiting'
    miniNotice = 'Your first lost letter will start the mini Wordle.'
    checkingGuess = false
    checkingMini = false
    activeBoard = 'main'
    try {
      answer = await (dailyMode ? getDailyWord(wordLength, new Date(), difficulty) : getRandomWord(wordLength, difficulty))
      gameState = 'playing'
    } catch {
      gameState = 'error'
      notice = 'The word list could not be loaded. Refresh to try again.'
    }
  }

  function evaluateMini(guess) {
    const state = evaluateGuess(guess, miniAnswer, miniLength)
    miniGuesses = [...miniGuesses, { word: guess, results: state }]
    miniGuess = ''
    if (guess === miniAnswer) {
      const revived = disabledLetters[0]
      disabledLetters = disabledLetters.slice(1)
      guesses = guesses.map(entry => entry.erased === revived ? { ...entry, restored: true } : entry)
      miniNotice = `${revived.toUpperCase()} is back in play.`
      if (disabledLetters.length) beginMini(disabledLetters[0])
      else miniState = 'waiting'
      return
    }
    if (miniGuesses.length >= miniMaxGuesses) {
      miniState = 'lost'
      miniNotice = `The word was ${miniAnswer.toUpperCase()}. Try again to revive ${disabledLetters[0]?.toUpperCase()}.`
    } else {
      miniNotice = 'Not quite. Keep trying.'
    }
  }

  async function submitMini() {
    if (miniState !== 'playing' || checkingMini) return
    if (miniGuess.length !== miniLength) {
      miniNotice = `This word needs ${miniLength} letters.`
      return
    }
    checkingMini = true
    const valid = await isAllowedWord(miniGuess)
    checkingMini = false
    if (miniState !== 'playing') return
    if (!valid) {
      miniNotice = 'That word is not in the dictionary.'
      return
    }
    evaluateMini(miniGuess)
  }

  async function submitGuess() {
    if (gameState !== 'playing' || checkingGuess) return
    if (currentGuess.length !== wordLength) {
      notice = `Your guess needs ${wordLength} letters.`
      return
    }
    checkingGuess = true
    const valid = await isAllowedWord(currentGuess)
    checkingGuess = false
    if (gameState !== 'playing') return
    if (!valid) {
      notice = 'That word is not in the dictionary.'
      return
    }

    const word = currentGuess
    const results = evaluateGuess(word, answer, wordLength)
    const candidates = [...new Set([...word])].filter(letter => !disabledLetters.includes(letter))
    const erased = candidates[Math.floor(Math.random() * candidates.length)]
    const erasedIndex = [...word].findIndex(letter => letter === erased)
    guesses = [...guesses, { word, results, erased, erasedIndex, restored: false }]
    currentGuess = ''
    if (erased) {
      disabledLetters = [...disabledLetters, erased]
      if (disabledLetters.length === 1 || miniState === 'waiting') beginMini(disabledLetters[0])
      notice = `${erased.toUpperCase()} was erased. Win the mini Wordle to bring it back.`
    } else {
      notice = 'Every letter in that guess is already out. Try another word.'
    }
    if (word === answer) {
      gameState = 'won'
      notice = `You got it in ${guesses.length} ${guesses.length === 1 ? 'guess' : 'guesses'}.`
    }
    await tick()
    if (historyElement) historyElement.scrollTop = historyElement.scrollHeight
  }

  function handleMainKey(key) {
    if (gameState !== 'playing' || checkingGuess) return
    notice = ''
    if (key === 'Enter') submitGuess()
    else if (key === 'Backspace') currentGuess = currentGuess.slice(0, -1)
    else if (/^[a-z]$/i.test(key) && currentGuess.length < wordLength && !disabledLetters.includes(key.toLowerCase())) currentGuess += key.toLowerCase()
  }

  function handleMiniKey(key) {
    if (miniState !== 'playing' || checkingMini) return
    if (key === 'Enter') submitMini()
    else if (key === 'Backspace') miniGuess = miniGuess.slice(0, -1)
    else if (/^[a-z]$/i.test(key) && miniGuess.length < miniLength) miniGuess += key.toLowerCase()
  }

  function handleOnScreenKey(key) {
    if (isMiniKeyboardActive()) handleMiniKey(key)
    else handleMainKey(key)
  }

  function isMiniKeyboardActive() {
    return window.matchMedia('(max-width: 43rem)').matches && activeBoard === 'mini'
  }

  function handleKeydown(event) {
    if (event.metaKey || event.ctrlKey || event.altKey || gameState !== 'playing') return
    if (/^[a-z]$/i.test(event.key) || event.key === 'Enter' || event.key === 'Backspace') {
      event.preventDefault()
      if (activeBoard === 'mini') handleMiniKey(event.key)
      else handleMainKey(event.key)
    }
  }

  onMount(startGame)
</script>

<svelte:window onkeydown={handleKeydown} />

<header class="game-header roulette-header">
  <button class="back-button" type="button" aria-label="Back to variants" onclick={onback}><ArrowLeft size={18} strokeWidth={1.8} /></button>
  <h1>Wordle, but it's Russian Roulette{#if dailyMode}<small class="daily-header-countdown">{dailyCountdown} until next word</small>{/if}</h1>
  <ModeInfo mode="roulette" />
</header>

<section class="roulette-panel" aria-label="Wordle, but it's Russian Roulette">
  <div class="roulette-main">
    <div class="roulette-history" bind:this={historyElement} aria-label="Previous guesses">
      {#each guesses as entry, rowIndex}
        <div class="guess-row roulette-guess-row" aria-label={`Guess ${rowIndex + 1}`}>
          {#each [...entry.word] as letter, index}
            <div class="guess-tile" class:correct={entry.results[index] === 'correct'} class:present={entry.results[index] === 'present'} class:absent={entry.results[index] === 'absent'} class:erased-tile={index === entry.erasedIndex && !entry.restored} aria-label={index === entry.erasedIndex && !entry.restored ? `${letter} erased` : `Letter ${letter}`}>{index === entry.erasedIndex && !entry.restored ? '' : letter.toUpperCase()}</div>
          {/each}
        </div>
      {/each}
    </div>
    <div class="guess-row roulette-current-row" role="group" aria-label="Current guess" onpointerdown={() => activeBoard = 'main'}>
      {#each Array(wordLength) as _, index}
        {@const value = currentGuess[index] ?? ''}
        <div class="guess-tile" class:filled={value}>{value.toUpperCase()}</div>
      {/each}
    </div>
    <div class="roulette-dead-letters" aria-live="polite">
      <span>Erased</span>
      {#if disabledLetters.length}
        {#each disabledLetters as letter}<strong>{letter.toUpperCase()}</strong>{/each}
      {:else}
        <span class="roulette-empty">None yet</span>
      {/if}
    </div>
    <div class="keyboard roulette-keyboard" aria-label="On-screen keyboard">
      {#each keyboardRows as row}
        <div class="keyboard-row">
          {#each [...row] as key}
            <button class="key" class:key-absent={!isMiniKeyboardActive() && disabledLetters.includes(key)} type="button" disabled={gameState !== 'playing' || (isMiniKeyboardActive() ? miniState !== 'playing' || checkingMini : checkingGuess || disabledLetters.includes(key))} aria-label={!isMiniKeyboardActive() && disabledLetters.includes(key) ? `${key} erased` : key} onclick={() => handleOnScreenKey(key)}>{key}</button>
          {/each}
        </div>
      {/each}
      <div class="keyboard-row last-row">
        <button class="key action-key" type="button" disabled={gameState !== 'playing' || (isMiniKeyboardActive() ? miniState !== 'playing' || checkingMini : checkingGuess)} onclick={() => handleOnScreenKey('Backspace')} aria-label="Backspace"><Delete size={17} strokeWidth={2} /></button>
        <button class="key enter-key" type="button" disabled={gameState !== 'playing' || (isMiniKeyboardActive() ? miniState !== 'playing' || checkingMini : checkingGuess)} onclick={() => handleOnScreenKey('Enter')}>ENTER</button>
      </div>
    </div>
    <div class="board-footer roulette-footer" aria-live="polite">
      <span class="notice">{notice || (gameState === 'loading' ? 'Loading…' : gameState === 'won' ? 'Word found.' : 'Type a word or use the keyboard.')}</span>
      {#if gameState === 'won'}<button class="play-again" type="button" onclick={startGame}>PLAY AGAIN</button>{/if}
    </div>
  </div>

  <aside class="roulette-mini" class:roulette-mini-active={activeBoard === 'mini'} aria-label="Letter revival mini Wordle" onpointerdown={() => activeBoard = 'mini'}>
    <div class="roulette-mini-heading"><Dices size={17} strokeWidth={1.8} /><span>LETTER REVIVAL</span></div>
    {#if disabledLetters.length}
      <div class="roulette-revive-label">Bring back <strong>{disabledLetters[0].toUpperCase()}</strong></div>
      <div class="roulette-mini-board" aria-label="Mini Wordle board">
        {#each Array(miniMaxGuesses) as _, rowIndex}
          {@const entry = miniGuesses[rowIndex]}
          {@const row = entry?.word ?? (rowIndex === miniGuesses.length && miniState === 'playing' ? miniGuess : '')}
          <div class="roulette-mini-row" class:submitted={entry}>
            {#each Array(miniLength) as _, index}
              {@const value = row[index] ?? ''}
              {@const tileState = entry ? entry.results[index] : ''}
              <div class="guess-tile" class:filled={value} class:correct={tileState === 'correct'} class:present={tileState === 'present'} class:absent={tileState === 'absent'}>{value.toUpperCase()}</div>
            {/each}
          </div>
        {/each}
      </div>
      <p class="roulette-mini-touch-hint">Tap this board, then use the keyboard below.</p>
      <div class="roulette-mini-keys" aria-label="Mini Wordle keyboard">
        {#each keyboardRows as row}
          <div class="keyboard-row">
            {#each [...row] as key}
              <button class="key" type="button" disabled={miniState !== 'playing' || checkingMini} aria-label={key} onclick={() => handleMiniKey(key)}>{key}</button>
            {/each}
          </div>
        {/each}
        <div class="keyboard-row last-row">
          <button class="key action-key" type="button" disabled={miniState !== 'playing' || checkingMini} onclick={() => handleMiniKey('Backspace')} aria-label="Backspace"><Delete size={13} strokeWidth={2} /></button>
          <button class="key enter-key" type="button" disabled={miniState !== 'playing' || checkingMini} onclick={() => handleMiniKey('Enter')}>ENTER</button>
        </div>
      </div>
      <p class="roulette-mini-notice" aria-live="polite">{miniNotice || (miniState === 'loading' ? 'Picking a word…' : '')}</p>
      {#if miniState === 'lost'}<button class="roulette-mini-retry" type="button" onclick={() => beginMini(disabledLetters[0])}>TRY ANOTHER WORD</button>{/if}
    {:else}
      <div class="roulette-mini-empty">Make a guess to put a letter at risk.</div>
      <p class="roulette-mini-notice" aria-live="polite">{miniNotice}</p>
    {/if}
  </aside>
</section>
