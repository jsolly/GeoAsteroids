import { COOPERATIVE } from '../../shared/cooperativeRules';
import { isTowCableUtility } from '../../shared/shipUtilities';
import type { CrewAction } from '../../shared-types';
import { PlayerManager } from '../entities/player/PlayerManager';
import { ConnectionManager } from '../network/services/ConnectionManager';
import { cooperativeActive, getWorldCampaign } from '../network/worldCampaign';
import { worldFurnaces } from '../network/worldExploration';

export interface CrewRescueView {
  active: boolean;
  downedSeconds: number | null;
  target: { id: string; name: string } | null;
  reviveSeconds: number | null;
  shipmentValue: number;
  projectValue: number;
  supplyValue: number;
  canWithdraw: boolean;
  hazard: string | null;
}
export function readCrewRescue(): CrewRescueView {
  const manager = PlayerManager.getInstance();
  const pilot = manager.getLocalPlayer();
  const campaign = getWorldCampaign();
  const source = pilot ? worldFurnaces.intakeAt(pilot.ship.position) : undefined;
  const supplyValue = campaign?.supplies.find((s) => s.id === source?.id)?.value ?? 0;
  const now = Date.now() + (pilot?.ship.furnaceClockOffsetMs ?? 0);
  const phase = campaign?.hazard;
  const common = {
    active: cooperativeActive(),
    projectValue: campaign?.projectValue ?? 0,
    supplyValue,
    shipmentValue: Math.min(COOPERATIVE.shipmentValue, supplyValue),
    canWithdraw: Boolean(
      pilot &&
        pilot.ship.health > 0 &&
        isTowCableUtility(pilot.ship) &&
        (pilot.ship.harpoonTargetId == null || pilot.ship.harpoonTargetId === '') &&
        supplyValue > 0
    ),
    hazard:
      phase && phase.phase !== 'quiet'
        ? `${phase.kind === 'swarm' ? 'Spider swarm' : 'Meteor shower'} ${phase.phase === 'warning' ? 'in' : 'ends in'} ${Math.max(0, Math.ceil(((phase.phase === 'warning' ? phase.startsAt : phase.endsAt) - now) / 1000))}s`
        : null,
  };
  if (!pilot) {
    return { ...common, downedSeconds: null, target: null, reviveSeconds: null };
  }
  const target =
    pilot.ship.health > 0
      ? manager
          .getNonLocalPlayers()
          .filter(
            (other) =>
              other.ship.downedUntil &&
              Math.hypot(
                other.ship.position.x - pilot.ship.position.x,
                other.ship.position.y - pilot.ship.position.y
              ) <= COOPERATIVE.reviveRadius
          )
          .sort((a, b) => a.id.localeCompare(b.id))[0]
      : undefined;
  return {
    ...common,
    downedSeconds:
      pilot.ship.downedUntil != null &&
      pilot.ship.downedUntil !== 0 &&
      !Number.isNaN(pilot.ship.downedUntil)
        ? Math.max(0, Math.ceil((pilot.ship.downedUntil - now) / 1000))
        : null,
    target: target ? { id: target.id, name: target.name } : null,
    reviveSeconds: pilot.ship.rescue
      ? Math.max(0, Math.ceil((pilot.ship.rescue.completesAt - now) / 1000))
      : null,
  };
}
export function sendCrewAction(action: CrewAction): void {
  const pilot = PlayerManager.getInstance().getLocalPlayer();
  if (!pilot) {
    return;
  }
  if (action.kind === 'revive') {
    pilot.ship.rescue = {
      targetId: action.targetId,
      completesAt: Date.now() + pilot.ship.furnaceClockOffsetMs + COOPERATIVE.reviveMs,
    };
    pilot.ship.velocity = { x: 0, y: 0 };
    pilot.ship.thrusting = false;
    pilot.ship.releaseContourLock();
  }
  if (action.kind === 'release') {
    pilot.ship.rescue = null;
  }
  ConnectionManager.getInstance().sendMessage({ type: 'crewAction', id: pilot.id, data: action });
}
export function signalHere(signal: 'help' | 'nest'): void {
  const pilot = PlayerManager.getInstance().getLocalPlayer();
  if (pilot) {
    sendCrewAction({ kind: 'signal', signal, position: { ...pilot.ship.position } });
  }
}
