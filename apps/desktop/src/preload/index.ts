import { contextBridge, ipcRenderer } from 'electron'

const api = {
  call: (method: string, ...params: unknown[]): Promise<unknown> =>
    ipcRenderer.invoke('engine:call', method, params),

  onEvent: (cb: (method: string, payload: any) => void): (() => void) => {
    const handler = (_e: unknown, method: string, payload: any) => cb(method, payload)
    ipcRenderer.on('engine:event', handler)
    return () => ipcRenderer.off('engine:event', handler)
  },

  pickFolder: (): Promise<string | null> => ipcRenderer.invoke('dialog:openFolder'),

  /** Progreso en el icono de la taskbar. mode: 'none' limpia, 'indeterminate' anima, 'normal'/'error' usan value 0..1. */
  setProgress: (p: { mode: 'none' | 'indeterminate' | 'normal' | 'error'; value?: number }): void =>
    ipcRenderer.send('taskbar:progress', p),

  /** Notificación de sistema (toast). */
  notify: (n: { title: string; body: string }): void => ipcRenderer.send('app:notify', n),

  /** Insignia (overlay) en el icono de la taskbar. dataUrl null la quita. */
  setOverlay: (p: { dataUrl: string | null; description: string }): void => ipcRenderer.send('taskbar:overlay', p),

  /** Recorta el preview de la taskbar a una región de la ventana (null = ventana completa). */
  setThumbClip: (rect: { x: number; y: number; width: number; height: number } | null): void =>
    ipcRenderer.send('taskbar:thumbclip', rect),

  /** Abre un fichero en el editor (VS Code 'code -g file:line', o la app por defecto). */
  openInEditor: (p: { file: string; line?: number }): void => ipcRenderer.send('open:editor', p),
}

contextBridge.exposeInMainWorld('engine', api)

export type EngineApi = typeof api
