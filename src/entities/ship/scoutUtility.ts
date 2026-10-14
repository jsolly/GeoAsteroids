import { SURVEY_PROBE } from '../../../shared/surveyProbe';
import type { ScoutUtilityId } from '../../../shared-types';

export const SCOUT_UTILITY = {
  mineral_scan: {
    id: 'mineral_scan',
    name: 'Mineral Scan',
    hint: 'Tap to equip',
    copy: 'Scan minerals for the crew and scare nearby spiders away while active. Earn points when a Hauler delivers scanned rocks.',
  },
  survey_probe: {
    id: 'survey_probe',
    name: 'Survey Probe',
    hint: `Tap to equip · ${SURVEY_PROBE.MAX_PER_OWNER} max`,
    copy: `Aim and fire a beacon forward; misses disintegrate. It scans a ${SURVEY_PROBE.RANGE}-unit radius for ${SURVEY_PROBE.LIFETIME_MS / 60_000} minutes, with ${SURVEY_PROBE.MAX_HEALTH} health. Everyone benefits.`,
  },
} as const satisfies {
  [Id in ScoutUtilityId]: { id: Id; name: string; hint: string; copy: string };
};
