/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_JUDGE0_API_KEY: string
  readonly VITE_PARTYKIT_HOST: string
  readonly VITE_RESEND_API_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
