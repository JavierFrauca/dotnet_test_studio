import { app, BrowserWindow, ipcMain, dialog, Menu, Notification, nativeImage, shell } from 'electron'
import { join, resolve } from 'node:path'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { EngineClient } from './engine'

let mainWindow: BrowserWindow | null = null

/** Persistencia del tamaño/posición de la ventana entre sesiones. */
function boundsFile(): string {
  return join(app.getPath('userData'), 'window-state.json')
}
function loadBounds(): { width: number; height: number; x?: number; y?: number } | null {
  try {
    return JSON.parse(readFileSync(boundsFile(), 'utf-8'))
  } catch {
    return null
  }
}
function saveBounds(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return
  try {
    writeFileSync(boundsFile(), JSON.stringify(mainWindow.getBounds()))
  } catch {
    /* best effort */
  }
}
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
  const saved = loadBounds()
  mainWindow = new BrowserWindow({
    width: saved?.width ?? 1180,
    height: saved?.height ?? 760,
    x: saved?.x,
    y: saved?.y,
    minWidth: 880,
    minHeight: 560,
    backgroundColor: '#1b1b1d',
    title: 'Dotnet Test Studio',
    icon: existsSync(devIcon) ? devIcon : undefined,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: false,
      nodeIntegration: false,
    },
  })

  mainWindow.on('close', saveBounds)

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

ipcMain.on('open:editor', (_e, p: { file: string; line?: number }) => {
  if (!p?.file) return
  const line = p.line && p.line > 0 ? p.line : 1
  // Intenta VS Code (code -g file:line); si no está, abre con la app por defecto del SO.
  try {
    const child = spawn('code', ['-g', `${p.file}:${line}`], { shell: true, detached: true, stdio: 'ignore' })
    child.on('error', () => void shell.openPath(p.file))
    child.unref()
  } catch {
    void shell.openPath(p.file)
  }
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
