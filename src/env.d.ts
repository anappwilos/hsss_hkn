interface ImportMetaEnv {
  readonly DEV: boolean;
  readonly VITE_ENABLE_REMOTE_STORAGE?: string;
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_ADMIN_EMAIL?: string;
  readonly VITE_ADMIN_PASSWORD?: string;
  readonly VITE_SUPERADMIN_EMAIL?: string;
  readonly VITE_SUPERADMIN_PASSWORD?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.css';
declare module '*.png';
declare module '*.jpg';
