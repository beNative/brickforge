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
import { getCachedImage } from './services/imageService'

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
    ...(process.platform === 'linux' ? { icon } : {}),
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
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.brickforge')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Initialize Database
  try {
    initDatabase()
  } catch (error) {
    console.error('Failed to initialize database:', error)
  }

  // Register IPC Handlers
  registerImportHandlers()
  registerSetHandlers()
  registerSessionHandlers()
  registerExportHandlers()
  registerDocumentHandlers()
  registerImageHandlers()

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
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
