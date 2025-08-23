/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEBUG: string;
  readonly VITE_INVINCIBLE: string;
  readonly VITE_MULTIPLAYER_ENABLED: string;
  readonly VITE_WEBSOCKET_URL: string;
  readonly VITE_DISABLE_INVINCIBILITY: string;
  readonly VITE_CLIENT_LOG_LEVEL: string;

  // Debug configuration
  readonly VITE_DEBUG_BOT_COUNT: string;
  readonly VITE_DEBUG_DISABLE_MOVEMENT: string;
  readonly VITE_DEBUG_DISABLE_BOT_MOVEMENT: string;
  readonly VITE_DEBUG_DISABLE_BOT_GUNS: string;
  readonly VITE_DEBUG_PLACE_ROID_ON_BOT: string;
  readonly VITE_DEBUG_ROID_COUNT: string;
  readonly VITE_DEBUG_LOCAL_PLAYER_INVINCIBLE: string;
  readonly VITE_DEBUG_DRAW_ROIDS: string;

  readonly MODE: string;
  readonly DEV: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
