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
}

contextBridge.exposeInMainWorld('engine', api)

export type EngineApi = typeof api
