import { app, shell, BrowserWindow, ipcMain, protocol } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

import { initDatabase } from './database/connection'
import { registerImportHandlers } from './ipc/importHandlers'
import { registerSetHandlers } from './ipc/setHandlers'
import { registerSessionHandlers } from './ipc/sessionHandlers'
import { registerExportHandlers } from './ipc/exportHandlers'
import { registerDocumentHandlers } from './ipc/documentHandlers'
import { registerImageHandlers } from './ipc/imageHandlers'
import { registerSettingsHandlers } from './ipc/settingsHandlers'
import { registerMaintenanceHandlers } from './ipc/maintenanceHandlers'
import { registerLogHandlers } from './ipc/logHandlers'
import { registerSyncHandlers } from './ipc/syncHandlers'
import { info, error as logError } from './services/loggerService'
import { getCachedImage } from './services/imageService'
import { initUpdater } from './services/updateService'
import {
  loadSyncConfig,
  startPeriodicSync,
  stopPeriodicSync,
  runSyncInternal,
  getSyncConfig
} from './services/syncService'

// Register custom protocol scheme BEFORE app is ready
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'brickforge',
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true }
  }
])

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    frame: false, // Frameless window for custom styled titlebar
    autoHideMenuBar: true,
    icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  info('Electron application is ready. Performing initial settings...')
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.brickforge.app')
  info('AppUserModelId configured successfully: com.brickforge.app')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Initialize Database
  try {
    info('Initializing SQLite database connection...')
    initDatabase()
  } catch (error) {
    logError('Failed to initialize database:', error)
  }

  // Register IPC Handlers
  registerImportHandlers()
  registerSetHandlers()
  registerSessionHandlers()
  registerExportHandlers()
  registerDocumentHandlers()
  registerImageHandlers()
  registerSettingsHandlers()
  registerMaintenanceHandlers()
  registerLogHandlers()
  registerSyncHandlers()

  // Load sync config and run initial sync if enabled
  void loadSyncConfig().then((config) => {
    if (config.syncEnabled) {
      startPeriodicSync()
      if (config.syncAutoOnOpenClose) {
        setTimeout(() => {
          info('[Sync] Running startup auto-sync...')
          runSyncInternal().catch((err) => logError('Startup sync failed: ' + err.message))
        }, 5000)
      }
    }
  })

  // Initialize Auto-Updater
  try {
    info('Initializing application auto-updater...')
    initUpdater()
  } catch (error) {
    logError('Failed to initialize auto-updater:', error)
  }

  // Register custom protocol handler for serving cached images from SQLite
  protocol.handle('brickforge', (request) => {
    try {
      const url = new URL(request.url)
      const originalUrl = url.searchParams.get('url')
      if (!originalUrl) {
        return new Response('Missing url parameter', { status: 400 })
      }

      const cached = getCachedImage(originalUrl)
      if (!cached) {
        return new Response('Image not cached', { status: 404 })
      }

      return new Response(new Uint8Array(cached.data), {
        status: 200,
        headers: { 'Content-Type': cached.contentType }
      })
    } catch (error) {
      console.error('brickforge:// protocol error:', error)
      return new Response('Internal error', { status: 500 })
    }
  })

  // Window Controls IPC Handlers
  ipcMain.handle('window-minimize', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize()
  })
  ipcMain.handle('window-maximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) {
      if (win.isMaximized()) win.unmaximize()
      else win.maximize()
    }
  })
  ipcMain.handle('window-close', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close()
  })

  ipcMain.handle('get-app-version', () => {
    return app.getVersion()
  })

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  stopPeriodicSync()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

let isSyncingBeforeQuit = false
app.on('before-quit', (e) => {
  const config = getSyncConfig()
  if (config.syncEnabled && config.syncAutoOnOpenClose && !isSyncingBeforeQuit) {
    e.preventDefault()
    isSyncingBeforeQuit = true
    info('[Sync] Running final shutdown sync...')

    Promise.race([runSyncInternal(), new Promise((resolve) => setTimeout(resolve, 3000))])
      .then(() => {
        info('[Sync] Shutdown sync complete or timed out. Quitting.')
        app.quit()
      })
      .catch((err) => {
        logError('Shutdown sync error: ' + (err.message || err))
        app.quit()
      })
  }
})
