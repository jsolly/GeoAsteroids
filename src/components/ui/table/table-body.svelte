<script lang="ts">
  import { cn } from 'cn';
  import type { HTMLAttributes } from 'svelte/elements';
  import type { WithElementRef } from '../../../ui-utils';

  let {
    ref = $bindable(null),
    class: className,
    children,
    ...restProps
  }: WithElementRef<HTMLAttributes<HTMLTableSectionElement>> = $props();
</script>

<tbody
  bind:this={ref}
  data-slot="table-body"
  class={cn('[&_tr:last-child]:border-0', className)}
  {...restProps}
>
  {@render children?.()}
</tbody>
