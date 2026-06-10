import { ipcMain, dialog, BrowserWindow } from 'electron'
import { getSettings, saveSettings } from '../services/settingsService'
import { reconnectDatabase } from '../database/connection'

export function registerSettingsHandlers(): void {
  ipcMain.handle('get-settings', () => {
    try {
      return { success: true, settings: getSettings() }
    } catch (e: any) {
      console.error('Failed to get settings:', e)
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('update-settings', async (_event, newSettings) => {
    try {
      saveSettings(newSettings)
      reconnectDatabase()
      return { success: true }
    } catch (e: any) {
      console.error('Failed to update settings:', e)
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('select-db-folder', async (event) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (!win) return null

      const { filePaths, canceled } = await dialog.showOpenDialog(win, {
        title: 'Select Database Folder',
        properties: ['openDirectory', 'createDirectory']
      })

      if (canceled || filePaths.length === 0) {
        return null
      }

      return filePaths[0]
    } catch (e) {
      console.error('Failed to open select folder dialog:', e)
      return null
    }
  })
}
