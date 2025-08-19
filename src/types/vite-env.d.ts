/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEBUG: string;
  readonly VITE_INVINCIBLE: string;
  readonly VITE_MULTIPLAYER_ENABLED: string;
  readonly VITE_WEBSOCKET_URL: string;

  readonly VITE_DRAW_ASTEROIDS: string;
  readonly VITE_DISABLE_INVINCIBILITY: string;
  readonly VITE_CLIENT_LOG_LEVEL: string;
  readonly MODE: string;
  readonly DEV: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
