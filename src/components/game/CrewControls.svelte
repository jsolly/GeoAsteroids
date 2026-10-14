<script lang="ts">
  import { onDestroy } from 'svelte';
  import { COOPERATIVE } from '../../../shared/cooperativeRules';
  import type { CrewAction } from '../../../shared-types';
  import type { CrewRescueView } from '../../runtime/crewRescue';
  import Button from '../ui/button/button.svelte';

  let {
    view,
    act,
    signal,
  }: {
    view: CrewRescueView;
    act: (action: CrewAction) => void;
    signal: (kind: 'help' | 'nest') => void;
  } = $props();
  let requestedTarget = $state<string | null>(null);
  let pointerHeld = false;
  const active = $derived(view.reviveSeconds !== null);
  $effect(() => {
    // Target loss must release the external action, including an unacknowledged request.
    if (requestedTarget && view.target?.id !== requestedTarget) {
      release();
    }
  });
  function release() {
    if (requestedTarget || active) {
      requestedTarget = null;
      pointerHeld = false;
      act({ kind: 'release' });
    }
  }
  function start() {
    if (!view.target) {
      return;
    }
    requestedTarget = view.target.id;
    act({ kind: 'revive', targetId: view.target.id });
  }
  function begin(event: PointerEvent) {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    pointerHeld = true;
    start();
  }
  function activate(event: MouseEvent) {
    // Pointer activation is the hold above; keyboard and assistive clicks toggle.
    if (event.detail !== 0) {
      return;
    }
    if (active) {
      release();
    } else {
      start();
    }
  }
  function releasePointer() {
    if (pointerHeld) {
      release();
    }
  }
  onDestroy(release);
</script>

<svelte:window
  onpointerup={releasePointer}
  onpointercancel={releasePointer}
  onblur={release}
  onkeydown={(event) => {
    if (['w', 'a', 's', 'd', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key))
      release();
  }}
  onpointerdown={(event) => {
    if (!(event.target instanceof Element) || !event.target.closest('[data-revive]')) release();
  }}
/>
<svelte:document onvisibilitychange={release} />
<div class="crew-controls">
  {#if view.hazard}<p role="status">{view.hazard}</p>{/if}
  <p>
    Deep Scanner · {view.projectValue.toLocaleString()} / {COOPERATIVE.scannerValue.toLocaleString()}
    ore
  </p>
  {#if view.canWithdraw}<Button variant="outline" onclick={() => act({ kind: 'withdraw-supply' })}
      >Tow supply · {view.shipmentValue} ore</Button
    >{/if}
  {#if view.downedSeconds !== null}
    <p role="status">Downed · {view.downedSeconds}s to signal for rescue</p>
    <Button variant="outline" onclick={() => signal('help')}>Signal help</Button>
    <Button variant="outline" onclick={() => act({ kind: 'give-up' })}>Give up</Button>
  {:else if view.target}
    <Button
      variant="outline"
      class="h-auto min-h-11 max-w-full whitespace-normal [overflow-wrap:anywhere]"
      data-revive
      aria-pressed={active}
      onpointerdown={begin}
      onclick={activate}
      onblur={release}
    >
      {active ? 'Cancel rescue of' : 'Revive'}
      {view.target.name}{view.reviveSeconds !== null ? ` · ${view.reviveSeconds}s` : ''}
    </Button>
    <p>Hold the button, or activate it to start or cancel rescue.</p>
  {:else}
    <Button variant="outline" onclick={() => signal('help')}>Help here</Button>
    <Button variant="outline" onclick={() => signal('nest')}>Nest here</Button>
  {/if}
</div>

<style>
  .crew-controls {
    position: absolute;
    top: 76px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 6px;
    z-index: 25;
    max-width: calc(100% - 24px);
    touch-action: none;
  }
  @media (max-width: 600px) {
    .crew-controls {
      top: 132px;
      left: 12px;
      transform: none;
      width: calc(100% - 124px);
    }
  }
  p {
    width: 100%;
    text-align: center;
    color: var(--foreground);
    font-size: 0.8rem;
  }
</style>
