<script>
  import { onMount } from 'svelte'
  import Matter from 'matter-js'
  import { ArrowLeft, Delete, RotateCcw } from 'lucide-svelte'
  import { getRandomWord, getDailyWord, isAllowedWord } from './wordPicker.js'
  import ModeInfo from './ModeInfo.svelte'

  const wordLength = 8
  const maxGuesses = 6
  const keyboardRows = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm']
  let { onback, dailyMode = false, dailyCountdown = '', difficulty = 'normal' } = $props()
  let answer = $state('')
  let guesses = $state([])
  let slots = $state(Array(wordLength).fill(''))
  let gameState = $state('loading')
  let notice = $state('')
  let checkingGuess = $state(false)
  let stage
  let bodies = $state.raw([])
  const engine = Matter.Engine.create({ enableSleeping: true })
  let boundaries = []
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
    updateBoundaries()
  }

  function renderBody(body) {
    if (!body.element) return
    body.element.style.left = `${body.physics.position.x}px`
    body.element.style.top = `${body.physics.position.y}px`
    body.element.style.transform = `translate(-50%, -50%) rotate(${body.physics.angle}rad)`
  }

  function updateBoundaries() {
    if (!width || !height) return
    const thickness = 120
    const positions = [
      [width / 2, height + thickness / 2 - 18, width + thickness * 2, thickness],
      [-thickness / 2, height / 2, thickness, height + thickness * 2],
      [width + thickness / 2, height / 2, thickness, height + thickness * 2],
      [width / 2, -thickness / 2, width + thickness * 2, thickness]
    ]
    if (!boundaries.length) {
      boundaries = positions.map(([x, y, w, h]) => Matter.Bodies.rectangle(x, y, w, h, { isStatic: true, friction: 0.9, restitution: 0.12 }))
      Matter.Composite.add(engine.world, boundaries)
      return
    }
    boundaries.forEach((boundary, index) => {
      const [x, y, w, h] = positions[index]
      Matter.Body.setPosition(boundary, { x, y })
      if (boundary.bounds.max.x - boundary.bounds.min.x !== w || boundary.bounds.max.y - boundary.bounds.min.y !== h) {
        Matter.Composite.remove(engine.world, boundary)
        boundaries[index] = Matter.Bodies.rectangle(x, y, w, h, { isStatic: true, friction: 0.9, restitution: 0.12 })
        Matter.Composite.add(engine.world, boundaries[index])
      }
    })
    for (const item of bodies) {
      const nextSize = tileSize()
      if (item.physicsSize !== nextSize) {
        const scale = nextSize / item.physicsSize
        Matter.Body.scale(item.physics, scale, scale)
        item.physicsSize = nextSize
      }
      Matter.Body.setPosition(item.physics, {
        x: Math.max(nextSize / 2, Math.min(width - nextSize / 2, item.physics.position.x)),
        y: Math.min(item.physics.position.y, height - 18 - nextSize / 2)
      })
    }
  }

  function removeBodies(items = bodies) {
    Matter.Composite.remove(engine.world, items.map(item => item.physics))
    bodies = bodies.filter(item => !items.includes(item))
  }

  function tick(time) {
    frame = requestAnimationFrame(tick)
    if (!width || !height) measure()
    engine.gravity.x = (sensorGravityX + sensorShakeX) / 1350
    engine.gravity.y = (sensorGravityY + sensorShakeY) / 1350
    const delta = lastFrame ? Math.min(32, time - lastFrame) : 16.667
    lastFrame = time
    Matter.Engine.update(engine, delta)

    for (const body of bodies) renderBody(body)
  }

  function spawn(letter) {
    if (gameState !== 'playing' || slots.every(Boolean)) return
    const size = tileSize()
    const physics = Matter.Bodies.rectangle(
      Math.max(size / 2, Math.min(width - size / 2, width / 2 + (Math.random() - 0.5) * width * 0.62)),
      size / 2 + Math.random() * Math.min(32, height * 0.1),
      size,
      size,
      { friction: 0.72, frictionStatic: 0.95, frictionAir: 0.008, restitution: 0.12 }
    )
    Matter.Body.setAngle(physics, (Math.random() - 0.5) * 0.18)
    Matter.Body.setVelocity(physics, { x: (Math.random() - 0.5) * 1.6, y: Math.random() * 0.4 })
    Matter.Composite.add(engine.world, physics)
    const body = {
      id: ++nextId,
      letter,
      physics,
      physicsSize: size,
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
      if (body) removeBodies([body])
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
    const point = {
      x: Math.max(0, Math.min(width, event.clientX - rect.left)),
      y: Math.max(0, Math.min(height, event.clientY - rect.top))
    }
    const offset = Matter.Vector.rotate(Matter.Vector.sub(point, body.physics.position), -body.physics.angle)
    body.dragConstraint = Matter.Constraint.create({
      bodyB: body.physics,
      pointA: point,
      pointB: offset,
      length: 0,
      stiffness: 0.18,
      damping: 0.16
    })
    Matter.Composite.add(engine.world, body.dragConstraint)
  }

  function dragMove(event, body) {
    if (!body.dragging) return
    const rect = stage.getBoundingClientRect()
    body.dragConstraint.pointA = {
      x: Math.max(0, Math.min(width, event.clientX - rect.left)),
      y: Math.max(0, Math.min(height, event.clientY - rect.top))
    }
  }

  function dragEnd(body) {
    body.dragging = false
    if (body.element) body.element.style.zIndex = '1'
    Matter.Composite.remove(engine.world, body.dragConstraint)
    body.dragConstraint = undefined
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
        .map(body => ({ body, distance: Math.hypot(body.physics.position.x - targetX(index), body.physics.position.y - height / 2) }))
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
    removeBodies(bodies.filter(body => consumed.has(body.id)))
    notice = `${locked} ${locked === 1 ? 'letter' : 'letters'} locked.`
    if (slots.every(Boolean)) await submitGuess()
  }

  function clearRow() {
    if (checkingGuess || gameState !== 'playing') return
    slots = Array(wordLength).fill('')
    removeBodies()
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
    guesses = [...guesses, { word: guess, feedback: evaluateGuess(guess) }]
    slots = Array(wordLength).fill('')
    removeBodies()
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
    removeBodies()
    checkingGuess = false
    try {
      answer = await (dailyMode ? getDailyWord(wordLength, new Date(), difficulty) : getRandomWord(wordLength, difficulty))
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
      Matter.Engine.clear(engine)
    }
  })
</script>

<svelte:window onkeydown={handleKeydown} />

<header class="game-header gravity-header">
  <button class="back-button" type="button" aria-label="Back to variants" onclick={onback}><ArrowLeft size={18} strokeWidth={1.8} /></button>
  <h1>Wordle, but gravity was just invented{#if dailyMode}<small class="daily-header-countdown">{dailyCountdown} until next word</small>{/if}</h1>
  <ModeInfo mode="gravity" />
</header>

<section class="gravity-panel" aria-label="Wordle, but gravity was just invented" onpointerdown={() => requestMotionAccess(true)}>
  <div class="gravity-history" aria-label="Previous guesses">
    {#each guesses as guess, rowIndex}
      <div class="guess-row submitted" aria-label={`Guess ${rowIndex + 1}: ${guess.word}`}>
        {#each [...guess.word] as letter, index}
          {@const result = guess.feedback[index]}
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
          {@const slotFeedback = slots.some(Boolean) ? evaluateGuess(slots.join('')) : []}
          <div
            class="gravity-slot"
            class:gravity-slot-filled={slots[index]}
            class:correct={slots[index] && slotFeedback[index] === 'correct'}
            class:present={slots[index] && slotFeedback[index] === 'present'}
            class:absent={slots[index] && slotFeedback[index] === 'absent'}
            aria-label={`Position ${index + 1}${slots[index] ? `: ${slots[index]}, ${slotFeedback[index]}` : ''}`}
          >{slots[index]?.toUpperCase()}</div>
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
