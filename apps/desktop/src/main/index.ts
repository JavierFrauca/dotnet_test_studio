import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron'
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
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 880,
    minHeight: 560,
    backgroundColor: '#1b1b1d',
    title: 'dotnet test studio',
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

ipcMain.handle('dialog:openFolder', async () => {
  const res = await dialog.showOpenDialog(mainWindow!, {
    title: 'Selecciona una solución, proyecto o carpeta',
    properties: ['openDirectory'],
  })
  return res.canceled ? null : res.filePaths[0]
})

app.whenReady().then(async () => {
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
