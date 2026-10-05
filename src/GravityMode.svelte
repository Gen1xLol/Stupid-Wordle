<script>
  import { onMount } from 'svelte'
  import { ArrowLeft, Delete, RotateCcw } from 'lucide-svelte'
  import { getRandomWord, isAllowedWord } from './wordPicker.js'

  const wordLength = 8
  const maxGuesses = 6
  const keyboardRows = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm']
  let { onback } = $props()
  let answer = $state('')
  let guesses = $state([])
  let slots = $state(Array(wordLength).fill(''))
  let gameState = $state('loading')
  let notice = $state('')
  let checkingGuess = $state(false)
  let stage
  let bodies = $state.raw([])
  let nextId = 0
  let frame = 0
  let lastFrame = 0
  let width = 0
  let height = 0
  let motionPermissionRequested = false
  let motionListening = false
  let sensorGravityX = 0
  let sensorGravityY = 1350
  let sensorShakeX = 0
  let sensorShakeY = 0

  function tileSize() {
    return Math.max(24, Math.min(52, (width - 18 - 7 * 5) / 8))
  }

  function rotatedExtent(angle, size) {
    const half = size / 2
    return half * (Math.abs(Math.cos(angle)) + Math.abs(Math.sin(angle)))
  }

  function getCollision(a, b, size) {
    const deltaX = b.x - a.x
    const deltaY = b.y - a.y
    const axes = [
      [Math.cos(a.angle), Math.sin(a.angle)],
      [-Math.sin(a.angle), Math.cos(a.angle)],
      [Math.cos(b.angle), Math.sin(b.angle)],
      [-Math.sin(b.angle), Math.cos(b.angle)]
    ]
    let smallestOverlap = Infinity
    let normalX = 0
    let normalY = 0
    const half = size / 2

    for (const [axisX, axisY] of axes) {
      const distance = deltaX * axisX + deltaY * axisY
      const extentA = half * (Math.abs(Math.cos(a.angle) * axisX + Math.sin(a.angle) * axisY) + Math.abs(-Math.sin(a.angle) * axisX + Math.cos(a.angle) * axisY))
      const extentB = half * (Math.abs(Math.cos(b.angle) * axisX + Math.sin(b.angle) * axisY) + Math.abs(-Math.sin(b.angle) * axisX + Math.cos(b.angle) * axisY))
      const overlap = extentA + extentB - Math.abs(distance)
      if (overlap <= 0) return null
      if (overlap < smallestOverlap) {
        smallestOverlap = overlap
        const direction = distance < 0 ? -1 : 1
        normalX = axisX * direction
        normalY = axisY * direction
      }
    }

    return { normalX, normalY, overlap: smallestOverlap }
  }

  function floorY() {
    return height - 18
  }

  function targetX(index) {
    const size = tileSize()
    const rowWidth = size * wordLength + 5 * (wordLength - 1)
    return (width - rowWidth) / 2 + size / 2 + index * (size + 5)
  }

  function measure() {
    if (!stage) return
    const rect = stage.getBoundingClientRect()
    width = rect.width
    height = rect.height
    for (const body of bodies) {
      if (!body.dragging) body.y = Math.min(body.y, floorY() - rotatedExtent(body.angle, tileSize()))
    }
  }

  function renderBody(body) {
    if (!body.element) return
    body.element.style.left = `${body.x}px`
    body.element.style.top = `${body.y}px`
    body.element.style.transform = `translate(-50%, -50%) rotate(${body.angle}rad)`
  }

  function tick(time) {
    frame = requestAnimationFrame(tick)
    if (!lastFrame) lastFrame = time
    const dt = Math.min(0.032, (time - lastFrame) / 1000)
    lastFrame = time
    if (!width || !height) measure()
    const size = tileSize()
    const bottom = floorY()
    const active = bodies.filter(body => !body.dragging)

    for (const body of active) {
      body.vx += (sensorGravityX + sensorShakeX) * dt
      body.vy += (sensorGravityY + sensorShakeY) * dt
      body.x += body.vx * dt
      body.y += body.vy * dt
      body.spin = Math.max(-5, Math.min(5, body.spin))
      body.angle += body.spin * dt
      const extentX = rotatedExtent(body.angle, size)
      const extentY = extentX
      body.vx *= Math.pow(0.996, dt * 60)
      body.spin *= Math.pow(0.97, dt * 60)

      if (body.x < extentX) {
        body.x = extentX
        body.vx = Math.abs(body.vx) * 0.55
        body.spin += body.vy * 0.002
      } else if (body.x > width - extentX) {
        body.x = width - extentX
        body.vx = -Math.abs(body.vx) * 0.55
        body.spin -= body.vy * 0.002
      }

      if (body.y > bottom - extentY) {
        body.y = bottom - extentY
        if (body.vy > 35) body.vy *= -0.3
        else body.vy = 0
        body.vx *= 0.86
        body.spin *= 0.82
      }
    }

    for (let pass = 0; pass < 2; pass += 1) {
      for (let first = 0; first < active.length; first += 1) {
        for (let second = first + 1; second < active.length; second += 1) {
          const a = active[first]
          const b = active[second]
          const collision = getCollision(a, b, size)
          if (!collision) continue
          const { normalX, normalY, overlap } = collision
          const correction = (overlap + 0.01) * 0.51
          a.x -= normalX * correction
          a.y -= normalY * correction
          b.x += normalX * correction
          b.y += normalY * correction
          const relative = (b.vx - a.vx) * normalX + (b.vy - a.vy) * normalY
          if (relative < 0) {
            const impulse = -relative * 0.48
            a.vx -= impulse * normalX
            a.vy -= impulse * normalY
            b.vx += impulse * normalX
            b.vy += impulse * normalY
            a.spin = Math.max(-5, Math.min(5, a.spin - normalY * impulse * 0.004))
            b.spin = Math.max(-5, Math.min(5, b.spin + normalY * impulse * 0.004))
          }
        }
      }
      for (const body of active) {
        const extent = rotatedExtent(body.angle, size)
        body.x = Math.max(extent, Math.min(width - extent, body.x))
        if (body.y > bottom - extent) {
          body.y = bottom - extent
          if (body.vy > 35) body.vy *= -0.25
          else body.vy = 0
          body.vx *= 0.86
        }
      }
    }

    for (const body of bodies) renderBody(body)
  }

  function spawn(letter) {
    if (gameState !== 'playing' || slots.every(Boolean)) return
    const size = tileSize()
    const body = {
      id: ++nextId,
      letter,
      x: Math.max(size / 2, Math.min(width - size / 2, width / 2 + (Math.random() - 0.5) * width * 0.62)),
      y: size / 2 + Math.random() * Math.min(32, height * 0.1),
      vx: (Math.random() - 0.5) * 100,
      vy: Math.random() * 25,
      angle: (Math.random() - 0.5) * 0.18,
      spin: (Math.random() - 0.5) * 1.7,
      dragging: false,
      element: undefined
    }
    bodies = [...bodies, body]
    notice = ''
  }

  function handleKey(key) {
    if (gameState !== 'playing' || checkingGuess) return
    if (/^[a-z]$/i.test(key)) {
      spawn(key.toLowerCase())
    } else if (key === 'Backspace') {
      const body = [...bodies].reverse().find(item => !item.dragging)
      if (body) bodies = bodies.filter(item => item.id !== body.id)
    } else if (key === 'Enter') {
      lockLetters()
    }
  }

  function handleKeydown(event) {
    if (event.metaKey || event.ctrlKey || event.altKey || gameState !== 'playing') return
    if (/^[a-z]$/i.test(event.key) || event.key === 'Enter' || event.key === 'Backspace') {
      requestMotionAccess(true)
      event.preventDefault()
      handleKey(event.key)
    }
  }

  function dragStart(event, body) {
    if (gameState !== 'playing' || checkingGuess) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    event.currentTarget.style.zIndex = '3'
    const rect = stage.getBoundingClientRect()
    body.dragging = true
    body.vx = 0
    body.vy = 0
    body.dragX = event.clientX - rect.left
    body.dragY = event.clientY - rect.top
    body.dragTime = performance.now()
    body.previousX = body.dragX
    body.previousY = body.dragY
    body.x = body.dragX
    body.y = body.dragY
    renderBody(body)
  }

  function dragMove(event, body) {
    if (!body.dragging) return
    const rect = stage.getBoundingClientRect()
    const now = performance.now()
    const nextX = event.clientX - rect.left
    const nextY = event.clientY - rect.top
    const elapsed = Math.max(0.012, (now - body.dragTime) / 1000)
    const deltaX = nextX - body.previousX
    const deltaY = nextY - body.previousY
    body.vx = (nextX - body.previousX) / elapsed
    body.vy = (nextY - body.previousY) / elapsed
    body.angle = (body.angle + deltaX * 0.014 + deltaY * 0.004) % (Math.PI * 2)
    body.spin = Math.max(-5, Math.min(5, body.vx * 0.004))
    body.previousX = nextX
    body.previousY = nextY
    body.dragTime = now
    body.x = Math.max(tileSize() * 0.45, Math.min(width - tileSize() * 0.45, nextX))
    body.y = Math.max(tileSize() * 0.45, Math.min(height - tileSize() * 0.45, nextY))
    renderBody(body)
  }

  function dragEnd(body) {
    body.dragging = false
    if (body.element) body.element.style.zIndex = '1'
    body.vx = Math.max(-850, Math.min(850, body.vx))
    body.vy = Math.max(-850, Math.min(850, body.vy))
  }

  async function lockLetters() {
    if (gameState !== 'playing' || checkingGuess) return
    const nextSlots = [...slots]
    const consumed = new Set()
    let locked = 0
    for (let index = 0; index < wordLength; index += 1) {
      if (nextSlots[index]) continue
      const candidate = bodies
        .filter(body => !consumed.has(body.id))
        .map(body => ({ body, distance: Math.hypot(body.x - targetX(index), body.y - height / 2) }))
        .filter(item => item.distance < tileSize() * 0.53)
        .sort((a, b) => a.distance - b.distance)[0]
      if (!candidate) continue
      nextSlots[index] = candidate.body.letter
      consumed.add(candidate.body.id)
      locked += 1
    }
    if (!locked) {
      notice = 'Settle a letter onto a square first.'
      return
    }
    slots = nextSlots
    bodies = bodies.filter(body => !consumed.has(body.id))
    notice = `${locked} ${locked === 1 ? 'letter' : 'letters'} locked.`
    if (slots.every(Boolean)) await submitGuess()
  }

  function clearRow() {
    if (checkingGuess || gameState !== 'playing') return
    slots = Array(wordLength).fill('')
    bodies = []
    notice = 'Row cleared. Start with a fresh drop.'
  }

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

  async function submitGuess() {
    const guess = slots.join('')
    checkingGuess = true
    const valid = await isAllowedWord(guess)
    checkingGuess = false
    if (gameState !== 'playing') return
    if (!valid) {
      notice = 'That word is not in the dictionary. Clear the row to try again.'
      return
    }
    guesses = [...guesses, guess]
    slots = Array(wordLength).fill('')
    bodies = []
    if (guess === answer) {
      gameState = 'won'
      notice = 'Gravity did its job. You got it.'
    } else if (guesses.length >= maxGuesses) {
      gameState = 'lost'
      notice = `Out of guesses. The word was ${answer.toUpperCase()}.`
    } else {
      notice = 'New row. Let the letters fall.'
    }
  }

  async function startGame() {
    gameState = 'loading'
    notice = ''
    guesses = []
    slots = Array(wordLength).fill('')
    bodies = []
    checkingGuess = false
    try {
      answer = await getRandomWord(wordLength)
      gameState = 'playing'
      notice = 'Type a word. Move your phone or drag the letters into place.'
    } catch {
      gameState = 'error'
      notice = 'The word list could not be loaded. Refresh to try again.'
    }
  }

  function handleMotion(event) {
    const orientation = ((window.screen.orientation?.angle ?? window.orientation ?? 0) * Math.PI) / 180
    const cosine = Math.cos(orientation)
    const sine = Math.sin(orientation)
    const gravity = event.accelerationIncludingGravity
    if (Number.isFinite(gravity?.x) && Number.isFinite(gravity?.y)) {
      const scale = 1350 / 9.81
      const targetX = Math.max(-1350, Math.min(1350, (-gravity.x * cosine - gravity.y * sine) * scale))
      const targetY = Math.max(-1350, Math.min(1350, (-gravity.x * sine + gravity.y * cosine) * scale))
      sensorGravityX += (targetX - sensorGravityX) * 0.35
      sensorGravityY += (targetY - sensorGravityY) * 0.35
    }

    const acceleration = event.acceleration
    if (Number.isFinite(acceleration?.x) && Number.isFinite(acceleration?.y)) {
      const scale = 55
      const targetX = Math.max(-1100, Math.min(1100, (-acceleration.x * cosine - acceleration.y * sine) * scale))
      const targetY = Math.max(-1100, Math.min(1100, (-acceleration.x * sine + acceleration.y * cosine) * scale))
      sensorShakeX += (targetX - sensorShakeX) * 0.55
      sensorShakeY += (targetY - sensorShakeY) * 0.55
    } else {
      sensorShakeX *= 0.7
      sensorShakeY *= 0.7
    }
  }

  function requestMotionAccess(fromGesture = false) {
    const motionApi = window.DeviceMotionEvent
    if (!motionApi || motionPermissionRequested || motionListening) return
    const requestPermission = motionApi.requestPermission
    if (typeof requestPermission === 'function') {
      if (!fromGesture) return
      motionPermissionRequested = true
      requestPermission.call(motionApi).then(permission => {
        if (permission === 'granted') {
          window.addEventListener('devicemotion', handleMotion, { passive: true })
          motionListening = true
        }
      }).catch(() => {})
      return
    }
    window.addEventListener('devicemotion', handleMotion, { passive: true })
    motionListening = true
  }

  onMount(() => {
    measure()
    window.addEventListener('resize', measure)
    frame = requestAnimationFrame(tick)
    requestMotionAccess()
    startGame()
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', measure)
      if (motionListening) window.removeEventListener('devicemotion', handleMotion)
    }
  })
</script>

<svelte:window onkeydown={handleKeydown} />

<header class="game-header gravity-header">
  <button class="back-button" type="button" aria-label="Back to variants" onclick={onback}><ArrowLeft size={18} strokeWidth={1.8} /></button>
  <h1>Wordle, but gravity was just invented</h1>
</header>

<section class="gravity-panel" aria-label="Wordle, but gravity was just invented" onpointerdown={() => requestMotionAccess(true)}>
  <div class="gravity-history" aria-label="Previous guesses">
    {#each guesses as guess, rowIndex}
      <div class="guess-row submitted" aria-label={`Guess ${rowIndex + 1}`}>
        {#each [...guess] as letter, index}
          {@const result = evaluateGuess(guess)[index]}
          <div class="guess-tile" class:correct={result === 'correct'} class:present={result === 'present'} class:absent={result === 'absent'}>{letter.toUpperCase()}</div>
        {/each}
      </div>
    {/each}
    {#if gameState === 'won' || gameState === 'lost'}
      <div class="gravity-end-mark">{gameState === 'won' ? 'WORD FOUND' : 'OUT OF GUESSES'}</div>
    {/if}
  </div>

  <div class="gravity-stage-wrap">
    <div class="gravity-stage" bind:this={stage} aria-label="Letters fall inside this play area">
      <div class="gravity-tray">
        {#each Array(wordLength) as _, index}
          <div class="gravity-slot" class:gravity-slot-filled={slots[index]} aria-label={`Position ${index + 1}${slots[index] ? `: ${slots[index]}` : ''}`}>{slots[index]?.toUpperCase()}</div>
        {/each}
      </div>
      {#each bodies as body (body.id)}
        <button
          bind:this={body.element}
          class="gravity-letter"
          type="button"
          style={`width:${tileSize()}px;height:${tileSize()}px;font-size:${tileSize() * 0.48}px`}
          aria-label={`Drag ${body.letter.toUpperCase()}`}
          onpointerdown={event => dragStart(event, body)}
          onpointermove={event => dragMove(event, body)}
          onpointerup={() => dragEnd(body)}
          onpointercancel={() => dragEnd(body)}
        >{body.letter.toUpperCase()}</button>
      {/each}
    </div>
  </div>

  <div class="gravity-controls">
    <div class="keyboard gravity-keyboard" aria-label="On-screen keyboard">
      {#each keyboardRows as row}
        <div class="keyboard-row">
          {#each [...row] as key}
            <button class="key" type="button" disabled={gameState !== 'playing' || checkingGuess} aria-label={`Drop ${key}`} onclick={() => handleKey(key)}>{key}</button>
          {/each}
        </div>
      {/each}
      <div class="keyboard-row last-row">
        <button class="key action-key" type="button" disabled={gameState !== 'playing' || checkingGuess} onclick={() => handleKey('Backspace')} aria-label="Remove a letter"><Delete size={17} strokeWidth={2} /></button>
        <button class="key enter-key" type="button" disabled={gameState !== 'playing' || checkingGuess} onclick={lockLetters}>LOCK LETTERS</button>
      </div>
    </div>
    <div class="gravity-footer" aria-live="polite">
      <span class="notice">{notice || (gameState === 'loading' ? 'Loading…' : 'Drag the letters around. They will not snap into place.')}</span>
      {#if gameState === 'playing' && slots.some(Boolean)}
        <button class="gravity-clear" type="button" onclick={clearRow}><RotateCcw size={14} /> CLEAR ROW</button>
      {/if}
      {#if gameState === 'won' || gameState === 'lost'}
        <button class="play-again" type="button" onclick={startGame}>PLAY AGAIN</button>
      {/if}
    </div>
  </div>
</section>
