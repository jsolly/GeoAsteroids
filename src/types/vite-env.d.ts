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
  readonly VITE_DEBUG_ROID_COUNT: string;
  readonly VITE_DEBUG_LOCAL_PLAYER_INVINCIBLE: string;
  readonly VITE_DEBUG_DISABLE_BOT_SPAWN_PROTECTION: string;

  readonly MODE: string;
  readonly DEV: boolean;
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
