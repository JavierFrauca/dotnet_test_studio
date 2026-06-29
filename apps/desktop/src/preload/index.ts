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
}

contextBridge.exposeInMainWorld('engine', api)

export type EngineApi = typeof api
