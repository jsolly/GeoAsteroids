<script lang="ts">
  import { getShipKit } from '../../../shared/shipKits';
  import type { ShipKitId } from '../../../shared-types';
  import { shipRatings } from '../../wiki/shipScorecard';

  // The shell mounts the radar into `radar` only for the active article; static rendering never does.
  // No fallback: the shell binds a keyed ref that starts undefined.
  let { id, radar = $bindable() }: { id: ShipKitId; radar?: HTMLElement | null | undefined } =
    $props();
  const kit = $derived(getShipKit(id));
  const ratings = $derived(shipRatings(id));
</script>

<section class="ship-scorecard" aria-labelledby={`${id}-scorecard-title`}>
  <div class="ship-scorecard-heading">
    <div>
      <p class="eyebrow">SHIP PROFILE</p>
      <h2 class="ship-scorecard-title" id={`${id}-scorecard-title`}>At a glance</h2>
    </div>
    <p class="ship-ability-name">
      <span class="ship-ability-label">E ABILITY</span>{kit.abilityName}
    </p>
  </div>
  <div class="ship-profile-layout">
    <div
      bind:this={radar}
      class="ship-radar"
      role="img"
      aria-label={`${kit.name} base stat profile, rated from 1 to 5. Exact values and ratings follow.`}
    ></div>
    <dl class="ship-stat-grid">
      {#each ratings as stat (stat.label)}
        <div class="ship-stat">
          <dt>{stat.label}</dt>
          <dd>
            <span class="ship-stat-value">{stat.display}</span><span
              class="stat-bubbles"
              role="img"
              aria-label={`${stat.rating} out of 5`}
              title={`${stat.rating} out of 5`}
              >{#each [1, 2, 3, 4, 5] as level (level)}<span
                  class={['stat-bubble', level <= stat.rating && 'filled']}
                  aria-hidden="true"
                ></span>{/each}</span
            >
          </dd>
        </div>
      {/each}
    </dl>
  </div>
  <details class="ship-rating-guide">
    <summary>How to read the ratings</summary>
    <p>
      More filled bubbles means a stronger base stat compared with the other ships. Each stat runs
      from 1 for the fleet’s lowest value to 5 for its highest, rounded to a whole bubble. Smaller
      size and shorter shot intervals and cooldowns score higher. Special abilities, growth, and
      upgrades aren’t ranked.
    </p>
  </details>
</section>

<style>
  .ship-scorecard {
    padding: 1.5rem;
    margin: 1.5rem 0;
    border: 1px solid var(--border);
    border-radius: 0.75rem;
  }
  .ship-profile-layout {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }
  .ship-radar {
    height: 260px;
    min-width: 0;
  }
  .ship-ability-name {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .ship-stat {
    display: flex;
    justify-content: space-between;
    padding: 0.5rem 0;
  }
  .stat-bubbles {
    display: inline-flex;
    gap: 3px;
    margin-left: 0.5rem;
  }
  .stat-bubble {
    width: 6px;
    height: 6px;
    border-radius: 100%;
    background: var(--muted);
  }
  .stat-bubble.filled {
    background: var(--foreground);
  }
  @media (max-width: 799px) {
    .ship-profile-layout {
      grid-template-columns: 1fr;
    }
  }
</style>
