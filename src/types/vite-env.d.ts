/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WEBSOCKET_URL: string;
  readonly VITE_CLIENT_LOG_LEVEL: string;

  // Debug configuration
  readonly VITE_DEBUG_LOCAL_PLAYER_INVINCIBLE: string;
  readonly VITE_DEBUG_BOT_COUNT: string;
  readonly VITE_DEBUG_ROID_COUNT: string;
  readonly VITE_DEBUG_DISABLE_BOT_MOVEMENT: string;
  readonly VITE_DEBUG_DISABLE_BOT_LASERS: string;
  readonly VITE_DEBUG_PLACE_ROID_ON_BOT: string;
  readonly VITE_DEBUG_DISABLE_ROID_MOVEMENT: string;
  readonly VITE_DEBUG_DISABLE_BOT_SPAWN_PROTECTION: string;
  readonly VITE_DEBUG_PLACE_BOTS_NEAR_LOCAL_PLAYER: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Extend the global Window interface for game controller access
interface Window {
  gameController?: {
    isDebugMode?: () => boolean;
  };
}
