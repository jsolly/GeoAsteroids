/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WEBSOCKET_URL: string;
  readonly VITE_CLIENT_LOG_LEVEL: string;
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
