import { ipcMain } from 'electron'
import { log, getLogs, clearLogs, openLogFolder } from '../services/loggerService'

export function registerLogHandlers(): void {
  ipcMain.handle('log', (_event, level, message) => {
    try {
      log(level, message)
      return { success: true }
    } catch (e: any) {
      console.error('Failed to log from renderer:', e)
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('get-logs', () => {
    try {
      return { success: true, logs: getLogs() }
    } catch (e: any) {
      console.error('Failed to get logs:', e)
      return { success: false, error: e.message, logs: [] }
    }
  })

  ipcMain.handle('clear-logs', () => {
    try {
      clearLogs()
      return { success: true }
    } catch (e: any) {
      console.error('Failed to clear logs:', e)
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('open-log-folder', () => {
    try {
      openLogFolder()
      return { success: true }
    } catch (e: any) {
      console.error('Failed to open log folder:', e)
      return { success: false, error: e.message }
    }
  })
}
