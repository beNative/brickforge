import { autoUpdater } from 'electron-updater'
import { ipcMain, BrowserWindow, app } from 'electron'
import { getSettings } from './settingsService'

// Enable basic logging to console
autoUpdater.logger = console

export function initUpdater(): void {
  // Handle IPC request from renderer to quit and install update immediately
  ipcMain.handle('update-relaunch', () => {
    console.log('Relaunching app to install downloaded update...')
    // Arguments: (isSilent, isForceRunAfter)
    autoUpdater.quitAndInstall(false, true)
  })

  // Handle IPC request for manual update check
  ipcMain.handle('update-check-now', async () => {
    console.log('Manual check for updates requested...')
    if (!app.isPackaged) {
      // Return a simulated response for development testing
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({ success: true, updateAvailable: true, version: '2.0.0-mock' })
          broadcastToWindows('update-available', {
            version: '2.0.0-mock',
            releaseDate: new Date().toISOString()
          })
        }, 1500)
      })
    }

    try {
      const result = await autoUpdater.checkForUpdates()
      const updateInfo = result?.updateInfo
      const version = updateInfo?.version
      const hasUpdate = version ? version !== app.getVersion() : false
      return { success: true, updateAvailable: hasUpdate, version }
    } catch (err: any) {
      console.error('Manual update check failed:', err)
      return { success: false, error: err.message || 'Failed to check for updates' }
    }
  })

  // Skip update checks in development
  if (!app.isPackaged) {
    console.log('Skipping auto-updater check in development')
    return
  }

  // Automatically download updates when available
  autoUpdater.autoDownload = true

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

  // Start background update check 5 seconds after startup if settings enable it
  const settings = getSettings()
  if (settings.autoUpdateEnabled) {
    setTimeout(() => {
      console.log('Checking for updates automatically...')
      autoUpdater.checkForUpdatesAndNotify().catch((err) => {
        console.error('Failed to check for updates:', err)
      })
    }, 5000)
  } else {
    console.log('Automatic update checks disabled via settings.')
  }
}

function broadcastToWindows(channel: string, data: any): void {
  const windows = BrowserWindow.getAllWindows()
  for (const win of windows) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, data)
    }
  }
}
