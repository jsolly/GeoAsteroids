import type { CampaignSnapshot } from '../../shared-types';
import { worldFurnaces } from './worldExploration';

let active = false;
let campaign: CampaignSnapshot | undefined;
export function setWorldCampaign(enabled = false, state?: CampaignSnapshot): void {
  active = enabled;
  campaign = enabled ? state : undefined;
  worldFurnaces.replaceFrontier(campaign?.commissioned ?? []);
}
export function cooperativeActive(): boolean {
  return active;
}
export function getWorldCampaign(): CampaignSnapshot | undefined {
  return campaign;
}
