import { autoUpdater } from 'electron-updater'
import { ipcMain, BrowserWindow } from 'electron'

// Enable basic logging to console
autoUpdater.logger = console

export function initUpdater(): void {
  // Automatically download updates when available
  autoUpdater.autoDownload = true

  // Handle IPC request from renderer to quit and install update immediately
  ipcMain.handle('update-relaunch', () => {
    console.log('Relaunching app to install downloaded update...')
    // Arguments: (isSilent, isForceRunAfter)
    autoUpdater.quitAndInstall(false, true)
  })

  // 1. Update available event
  autoUpdater.on('update-available', (info) => {
    console.log('Update available:', info.version)
    broadcastToWindows('update-available', {
      version: info.version,
      releaseDate: info.releaseDate
    })
  })

  // 2. Download progress event
  autoUpdater.on('download-progress', (progressInfo) => {
    broadcastToWindows('update-progress', {
      percent: Math.round(progressInfo.percent),
      bytesPerSecond: progressInfo.bytesPerSecond,
      transferred: progressInfo.transferred,
      total: progressInfo.total
    })
  })

  // 3. Update downloaded event
  autoUpdater.on('update-downloaded', (info) => {
    console.log('Update downloaded:', info.version)
    broadcastToWindows('update-downloaded', {
      version: info.version
    })
  })

  // 4. Error event
  autoUpdater.on('error', (err) => {
    console.error('Error in auto-updater:', err)
    broadcastToWindows('update-error', err.message || 'Unknown update error')
  })

  // Start background update check 5 seconds after startup
  setTimeout(() => {
    console.log('Checking for updates...')
    autoUpdater.checkForUpdatesAndNotify().catch((err) => {
      console.error('Failed to check for updates:', err)
    })
  }, 5000)
}

function broadcastToWindows(channel: string, data: any): void {
  const windows = BrowserWindow.getAllWindows()
  for (const win of windows) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, data)
    }
  }
}
