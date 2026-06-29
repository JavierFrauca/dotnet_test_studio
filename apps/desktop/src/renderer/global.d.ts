export interface EngineApi {
  call(method: string, ...params: unknown[]): Promise<unknown>
  onEvent(cb: (method: string, payload: any) => void): () => void
  pickFolder(): Promise<string | null>
}

declare global {
  /** Versión de la app, inyectada en build desde package.json (define de vite). */
  const __APP_VERSION__: string
  interface Window {
    engine: EngineApi
  }
}
