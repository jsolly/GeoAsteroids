/** Crisp menu / HUD / banner copy. Keep strings short — Atari vector, no clutter. */

export const MENU_PLAY_LABEL = 'PLAY';
export const MENU_CALLSIGN_LABEL = 'Callsign';

export const SCORE_LABEL = 'SCORE';
export const HULL_LABEL = 'HULL';

export const GAME_OVER_TITLE = 'GAME OVER';
export const GAME_OVER_HINT = 'returning to menu';

export const DISCONNECT_BANNER_TEXT = 'SIGNAL LOST — refresh to rejoin';

export function connectionFailureText(errorType: string): string {
  switch (errorType) {
    case 'timeout':
      return 'CONNECTION TIMED OUT';
    case 'auth':
      return 'AUTHENTICATION FAILED';
    case 'server':
      return 'SERVER ERROR';
    default:
      return 'CANNOT REACH SERVER';
  }
}
