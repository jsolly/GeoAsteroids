<script lang="ts">
  import { Dialog } from 'bits-ui';
  import { onMount, tick } from 'svelte';
  import { mountClientRelease, reloadClient } from '../release/clientReleaseEntry';
  import Button from './ui/button/button.svelte';
  import DialogContent from './ui/dialog/dialog-content.svelte';
  import DialogDescription from './ui/dialog/dialog-description.svelte';
  import DialogTitle from './ui/dialog/dialog-title.svelte';

  let { activeGame = false }: { activeGame?: boolean } = $props();
  const dialogId = $props.id();
  let release = $state<string | null>(null);
  const available = $derived(release !== null);
  const noticeText = $derived(
    activeGame === true
      ? 'An update is available. Updating reloads this tab, disconnects your flight and requires rejoining. Later keeps this tab open, but a server update may disconnect you or require a reload to rejoin.'
      : 'An update is available. Update and reload loads the latest version and clears unfinished input. This tab will not reload automatically.'
  );
  let applying = $state(false);
  let failure = $state('');

  let stopWatching = () => {};
  let application: AbortController | undefined;
  let interrupted = false;
  let mounted = false;
  let lastPageFocus: HTMLElement | null = null;
  function usable(element: HTMLElement): boolean {
    if (
      !element.isConnected ||
      element.closest('[hidden], [inert], [aria-hidden="true"], [data-update-confirmation]') !==
        null ||
      element.matches(':disabled, [aria-disabled="true"]')
    ) {
      return false;
    }
    for (
      let current: HTMLElement | null = element;
      current !== null;
      current = current.parentElement
    ) {
      const style = getComputedStyle(current);
      if (style.display === 'none' || style.visibility === 'hidden') {
        return false;
      }
    }
    return true;
  }
  function rememberPageFocus(target: EventTarget | null) {
    if (
      target instanceof HTMLElement &&
      target !== document.body &&
      !notice?.contains(target) &&
      target.closest('[data-update-confirmation]') === null
    ) {
      lastPageFocus = target;
    }
  }
  function focusPageControl() {
    if (!mounted) {
      return;
    }
    const fallback = [
      ...document.querySelectorAll<HTMLElement>(
        'canvas[tabindex], input:not([disabled]), button:not([disabled]), a[href]'
      ),
    ].find((element) => !notice?.contains(element) && usable(element));
    (lastPageFocus !== null && usable(lastPageFocus) ? lastPageFocus : fallback)?.focus();
  }
  function restorePageFocus(event: Event) {
    event.preventDefault();
    void tick().then(() => {
      if (!mounted) {
        return;
      }
      if (release !== null) {
        notice?.querySelector('button')?.focus();
      } else {
        focusPageControl();
      }
    });
  }
  function watch() {
    stopWatching();
    stopWatching = mountClientRelease((published, stale) => {
      if (published !== release) {
        const ownedFocus = notice?.contains(document.activeElement) === true;
        rememberPageFocus(document.activeElement);
        release = published;
        if (published === null && ownedFocus && !confirming) {
          void tick().then(() => {
            if (release === null && document.activeElement === document.body) {
              focusPageControl();
            }
          });
        }
        failure = stale
          ? 'The previous reload returned this version. You can try again when ready.'
          : '';
      }
    });
  }
  onMount(() => {
    mounted = true;
    watch();
    const focus = (event: FocusEvent) => rememberPageFocus(event.target);
    document.addEventListener('focusin', focus);
    const hide = () => {
      if (applying) {
        application?.abort();
        applying = false;
        interrupted = true;
      }
    };
    const show = (event: PageTransitionEvent) => {
      if (event.persisted && interrupted) {
        interrupted = false;
        watch();
      }
    };
    window.addEventListener('pagehide', hide);
    window.addEventListener('pageshow', show);
    return () => {
      mounted = false;
      document.removeEventListener('focusin', focus);
      window.removeEventListener('pagehide', hide);
      window.removeEventListener('pageshow', show);
      stopWatching();
      application?.abort();
    };
  });

  let confirming = $state(false);
  let dismissedRelease = $state<string | null>(null);
  const deferred = $derived(release !== null && dismissedRelease === release);
  let notice = $state<HTMLElement | undefined>();

  async function defer(value: boolean) {
    dismissedRelease = value ? release : null;
    await tick();
    notice?.querySelector('button')?.focus();
  }

  function cancelApplication() {
    if (applying) {
      application?.abort();
      applying = false;
      watch();
    }
  }

  async function apply() {
    if (applying || release === null) {
      return;
    }
    applying = true;
    failure = '';
    stopWatching();
    const controller = new AbortController();
    application = controller;
    const result = await reloadClient(release, controller.signal);
    if (controller.signal.aborted) {
      return;
    }
    application = undefined;
    if (result.kind === 'reloading') {
      return;
    }
    applying = false;
    switch (result.kind) {
      case 'changed':
        release = result.release;
        confirming = false;
        failure = 'A different update is now available. Review it and try again.';
        break;
      case 'current':
        release = null;
        failure = 'This page is already up to date.';
        break;
      case 'unavailable':
        failure =
          'Could not apply the update. Check your connection and browser storage, then try again.';
        break;
      default: {
        const unexpected: never = result;
        return unexpected;
      }
    }
    watch();
  }
</script>

<p class="sr-only" role="status" aria-atomic="true">
  {#key release}
    {available && !deferred && !confirming ? noticeText : ''}
  {/key}
  {confirming ? '' : failure}
</p>

<Dialog.Root
  bind:open={confirming}
  onOpenChange={(open) => {
    if (!open) {
      cancelApplication();
    }
  }}
>
  {#if available}
    <aside bind:this={notice} class="update-notice" aria-label="Website update">
      <p hidden={deferred}>{noticeText}</p>
      {#if failure && !deferred}<p>{failure}</p>{/if}
      <div class="flex flex-wrap gap-2">
        <Button
          aria-haspopup={deferred ? undefined : 'dialog'}
          aria-expanded={deferred ? undefined : confirming}
          aria-controls={deferred ? undefined : dialogId}
          onclick={() => {
            if (deferred) {
              void defer(false);
            } else {
              confirming = true;
            }
          }}>{deferred ? 'Update available' : 'Update and reload'}</Button
        >
        <Button hidden={deferred} variant="outline" onclick={() => defer(true)}>Later</Button>
      </div>
    </aside>
  {/if}
  <DialogContent id={dialogId} data-update-confirmation="" onCloseAutoFocus={restorePageFocus}>
    <p role="status" aria-atomic="true">{applying ? 'Checking update.' : failure}</p>
    <DialogTitle>Update and reload?</DialogTitle>
    <DialogDescription>
      {#if release === null}
        No reload is needed.
      {:else if activeGame === true}
        Reloading loads the latest version and disconnects your current flight. You will need to
        rejoin, and unfinished input will be lost. The game continues while this prompt is open.
        Keeping this tab open does not prevent a server update from disconnecting you or requiring a
        reload to rejoin. This tab will not reload automatically.
      {:else}
        Reloading loads the latest version. Any unfinished input on this page will be lost. This tab
        will not reload automatically.
      {/if}
    </DialogDescription>
    <div class="flex flex-wrap justify-end gap-2">
      <Button
        variant="outline"
        onclick={() => {
          cancelApplication();
          confirming = false;
        }}>Keep this page open</Button
      >
      <Button disabled={applying || release === null} onclick={apply}
        >{applying
          ? 'Checking update…'
          : release === null
            ? 'Already current'
            : 'Reload now'}</Button
      >
    </div>
  </DialogContent>
</Dialog.Root>

<style>
  .update-notice {
    position: fixed;
    z-index: 40;
    left: max(1rem, env(safe-area-inset-left));
    bottom: max(1rem, env(safe-area-inset-bottom));
    max-width: min(24rem, calc(100vw - 2rem));
    display: grid;
    gap: 0.5rem;
    padding: 0.75rem;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--card);
    color: var(--card-foreground);
    box-shadow: 0 4px 20px #0006;
    font:
      0.875rem/1.4 system-ui,
      sans-serif;
  }
  p {
    margin: 0;
  }
  @media (max-width: 640px) {
    .update-notice {
      bottom: max(8rem, calc(env(safe-area-inset-bottom) + 7rem));
    }
  }
</style>
