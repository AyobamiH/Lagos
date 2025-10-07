/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_ENABLE_DIAGNOSTICS?: string; // 'true' to enable overlay fetches
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
