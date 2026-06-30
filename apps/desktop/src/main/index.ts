import { app, BrowserWindow, ipcMain, dialog, Menu, Notification, nativeImage } from 'electron'
import { join, resolve } from 'node:path'
import { existsSync } from 'node:fs'
import { EngineClient } from './engine'

let mainWindow: BrowserWindow | null = null
const engine = new EngineClient()

/** Resuelve cómo lanzar el sidecar: exe empaquetado en producción, dll de dev si no. */
function resolveEngineCommand(): { command: string; args: string[] } {
  const override = process.env.DOTNETTEST_ENGINE
  if (override) return { command: override, args: [] }

  if (app.isPackaged) {
    const exe = join(process.resourcesPath, 'engine', 'DotnetTest.Engine.exe')
    return { command: exe, args: [] }
  }

  // Desarrollo: dll compilado del proyecto Engine (apps/desktop/out/main → raíz del repo).
  const repoRoot = resolve(__dirname, '../../../..')
  const dll = join(repoRoot, 'src', 'DotnetTest.Engine', 'bin', 'Debug', 'net10.0', 'DotnetTest.Engine.dll')
  if (!existsSync(dll)) {
    console.error('No se encontró el engine en', dll, '— compílalo con: dotnet build src/DotnetTest.Engine')
  }
  return { command: 'dotnet', args: [dll] }
}

function createWindow(): void {
  // En producción el icono lo lleva el exe; en dev lo tomamos del build/.
  const devIcon = join(__dirname, '../../build/icon.png')
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 880,
    minHeight: 560,
    backgroundColor: '#1b1b1d',
    title: 'dotnet test studio',
    icon: existsSync(devIcon) ? devIcon : undefined,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: false,
      nodeIntegration: false,
    },
  })

  engine.on('notify', (method: string, payload: unknown) => {
    mainWindow?.webContents.send('engine:event', method, payload)
  })
  engine.on('stderr', (line: string) => {
    if (process.env.DEBUG) console.error('[engine]', line)
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

ipcMain.handle('engine:call', async (_e, method: string, params: unknown[]) => {
  return engine.call(method, params ?? [])
})

ipcMain.on('taskbar:progress', (_e, p: { mode: string; value?: number }) => {
  if (!mainWindow) return
  const clamp = (v: number) => Math.max(0, Math.min(1, v))
  switch (p.mode) {
    case 'indeterminate':
      mainWindow.setProgressBar(2, { mode: 'indeterminate' })
      break
    case 'normal':
      mainWindow.setProgressBar(clamp(p.value ?? 0))
      break
    case 'error':
      mainWindow.setProgressBar(clamp(p.value ?? 1), { mode: 'error' })
      break
    default:
      mainWindow.setProgressBar(-1) // limpia
  }
})

ipcMain.on('taskbar:overlay', (_e, p: { dataUrl: string | null; description: string }) => {
  if (!mainWindow) return
  const img = p.dataUrl ? nativeImage.createFromDataURL(p.dataUrl) : null
  mainWindow.setOverlayIcon(img, p.description ?? '')
})

ipcMain.on('taskbar:thumbclip', (_e, rect: { x: number; y: number; width: number; height: number } | null) => {
  if (!mainWindow) return
  // {0,0,0,0} resetea al thumbnail de la ventana completa.
  mainWindow.setThumbnailClip(rect ?? { x: 0, y: 0, width: 0, height: 0 })
})

ipcMain.on('app:notify', (_e, n: { title: string; body: string }) => {
  if (!Notification.isSupported()) return
  const notif = new Notification({ title: n.title, body: n.body })
  notif.on('click', () => {
    mainWindow?.show()
    mainWindow?.focus()
  })
  notif.show()
})

ipcMain.handle('dialog:openFolder', async () => {
  const res = await dialog.showOpenDialog(mainWindow!, {
    title: 'Selecciona una solución, proyecto o carpeta',
    properties: ['openDirectory'],
  })
  return res.canceled ? null : res.filePaths[0]
})

app.whenReady().then(async () => {
  app.setAppUserModelId('com.dotnettest.studio') // toasts atribuidos a la app (icono/nombre correctos)
  Menu.setApplicationMenu(null) // sin barra de menú File/Edit/View/…
  try {
    await engine.start(resolveEngineCommand())
  } catch (err) {
    console.error('No se pudo arrancar el engine:', err)
  }
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })

  // Modo de verificación: arranca, comprueba y se cierra solo.
  if (process.env.DOTNETTEST_SMOKE) setTimeout(() => app.quit(), 7000)
})

app.on('window-all-closed', () => {
  engine.stop()
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => engine.stop())
