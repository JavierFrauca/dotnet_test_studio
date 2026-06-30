export interface EngineApi {
  call(method: string, ...params: unknown[]): Promise<unknown>
  onEvent(cb: (method: string, payload: any) => void): () => void
  pickFolder(): Promise<string | null>
  setProgress(p: { mode: 'none' | 'indeterminate' | 'normal' | 'error'; value?: number }): void
  notify(n: { title: string; body: string }): void
  setOverlay(p: { dataUrl: string | null; description: string }): void
  setThumbClip(rect: { x: number; y: number; width: number; height: number } | null): void
  openInEditor(p: { file: string; line?: number }): void
}

declare global {
  /** Versión de la app, inyectada en build desde package.json (define de vite). */
  const __APP_VERSION__: string
  interface Window {
    engine: EngineApi
  }
}
