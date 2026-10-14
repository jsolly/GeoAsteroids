import type { TerrainSpiderManager } from '../../server/core/TerrainSpiderManager';

type SpiderAdvanceOptions = Parameters<TerrainSpiderManager['advance']>[0];

/** Explicit empty boundaries for isolated spider scenarios; nests always use a resolver. */
export function spiderAdvanceFixture(
  options: Pick<SpiderAdvanceOptions, 'players' | 'nowFrame'> & Partial<SpiderAdvanceOptions>
): SpiderAdvanceOptions {
  const readResources = options.resources ?? (() => []);
  let observedResources: ReturnType<SpiderAdvanceOptions['resources']> = [];
  return {
    releaseTow: () => {},
    onNestCreated: () => {},
    ...options,
    resources: (players) => {
      observedResources = readResources(players);
      return observedResources;
    },
    resource:
      options.resource ?? ((id) => observedResources.find((resource) => resource.id === id)),
  };
}
