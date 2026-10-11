export interface ClientMessage {
  type:
    | 'join'
    | 'snapshotResync'
    | 'snapshotAck'
    | 'leave'
    | 'update'
    | 'shoot'
    | 'collisionDamage'
    | 'clientLog'
    | 'useAbility'
    | 'setHaulerUtility'
    | 'equipSatellite';
  id?: string; // Optional ID field for messages that need it
  data: unknown;
}
