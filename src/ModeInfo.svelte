<script>
  import { Info, X } from 'lucide-svelte'

  let { mode } = $props()
  let dialog

  const modeContent = {
    gun: {
      title: 'Wordle, but I have a Gun',
      intro: 'Get the 8-letter word in six guesses. Every new green earns a bullet. Spend a bullet to reveal a spot in the target row, but you only get one shot between guesses.',
      steps: ['Type a word and hit Enter.', 'New green spots earn bullets once.', 'Fire at one target tile for a letter hint. Make another guess to take another shot.']
    },
    gravity: {
      title: 'Wordle, but gravity was just invented',
      intro: 'Letters fall and bump around. Drop them into the row to build a guess, then lock it in.',
      steps: ['Type or tap letters to drop them in.', 'Drag letters into the slots. On a phone, tilt or shake to move them around.', 'Press Lock Letters when the row is ready. You get six guesses.']
    },
    roulette: {
      title: "Wordle, but it's Russian Roulette",
      intro: 'You get as many guesses as you need, but every valid guess costs a letter. Get it back by solving the little Wordle on the side.',
      steps: ['Make an 8-letter guess. One letter disappears from that row and gets locked on your keyboard.', 'Solve the 4-letter mini Wordle in five tries to revive the locked letter.', 'On a small screen, tap the mini board before using the shared keyboard.']
    }
  }

  function openDialog() {
    dialog?.showModal()
  }

  function closeDialog() {
    dialog?.close()
  }
</script>

<button class="mode-info-button" type="button" aria-label={`How to play ${modeContent[mode].title}`} onclick={openDialog}><Info size={18} strokeWidth={1.9} /></button>

<dialog class="mode-info-dialog" bind:this={dialog}>
  <div class="mode-info-content">
    <header class="mode-info-header">
      <div><span class="mode-info-eyebrow">HOW TO PLAY</span><h2>{modeContent[mode].title}</h2></div>
      <button class="mode-info-close" type="button" aria-label="Close instructions" onclick={closeDialog}><X size={18} /></button>
    </header>
    <p class="mode-info-intro">{modeContent[mode].intro}</p>
    {#if mode === 'gun'}
      <div class="mode-info-example">
        <div class="guess-row info-example-row">
          {#each [...'NOTECASE'] as letter, index}
            <div class="guess-tile" class:correct={index < 4} class:absent={index >= 4}>{letter}</div>
          {/each}
        </div>
        <p><strong>NOTECASE</strong> vs. <strong>NOTEBOOK</strong>: four exact hits, four bullets.</p>
      </div>
    {:else if mode === 'gravity'}
      <div class="mode-info-example">
        <div class="info-gravity-demo" aria-label="Letters falling toward a row of slots">
          <div class="info-gravity-letters"><span>A</span><span>R</span><span>E</span></div>
          <div class="info-gravity-slots">
            {#each Array(8) as _, index}<span class:gravity-slot-filled={index === 1 || index === 4}>{index === 1 ? 'A' : index === 4 ? 'R' : ''}</span>{/each}
          </div>
        </div>
        <p>Drop letters in, line them up, then lock the row.</p>
      </div>
    {:else}
      <div class="mode-info-example">
        <div class="guess-row info-example-row">
          {#each [...'NOTECASE'] as letter, index}
            <div class="guess-tile" class:correct={index < 4} class:absent={index >= 4} class:erased-tile={index === 4}>{index === 4 ? '' : letter}</div>
          {/each}
        </div>
        <div class="info-mini-row" aria-label="Four-letter mini Wordle example">
          {#each [...'WORD'] as letter, index}<div class="guess-tile" class:present={index === 0} class:correct={index === 1} class:absent={index === 2 || index === 3}>{letter}</div>{/each}
        </div>
        <p>The missing tile comes back when you solve the mini Wordle.</p>
      </div>
    {/if}
    <ol class="mode-info-steps">
      {#each modeContent[mode].steps as step}<li>{step}</li>{/each}
    </ol>
    <button class="play-again mode-info-done" type="button" onclick={closeDialog}>Got it</button>
  </div>
</dialog>
