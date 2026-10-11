<script lang="ts">
  import type { ShipKitId } from '../../../shared-types';
  import { serializeKitHullSvg } from '../../entities/ship/hullOutlines';

  let { id, size }: { id: ShipKitId; size: number } = $props();
  const svg = $derived(
    serializeKitHullSvg(id, { background: false, title: false, width: size, height: size })
  );
</script>

<span aria-hidden="true"
  ><img
    src={`data:image/svg+xml,${encodeURIComponent(svg)}`}
    width={size}
    height={size}
    alt=""
  /></span
>
