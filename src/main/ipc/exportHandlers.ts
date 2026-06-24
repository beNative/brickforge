import { ipcMain, dialog, BrowserWindow } from 'electron'
import { exportMissingParts } from '../services/exportService'

export function registerExportHandlers(): void {
  ipcMain.handle(
    'export-missing-parts',
    async (
      event,
      sessionId: number,
      format: 'csv' | 'json' | 'xml',
      filter: 'all_missing' | 'non_spares_missing' | 'spares_missing'
    ) => {
      try {
        const window = BrowserWindow.fromWebContents(event.sender)
        if (!window) throw new Error('No parent window found for dialog.')

        let ext = 'csv'
        let filterLabel = 'CSV Files (*.csv)'
        if (format === 'json') {
          ext = 'json'
          filterLabel = 'JSON Files (*.json)'
        } else if (format === 'xml') {
          ext = 'xml'
          filterLabel = 'XML Files (*.xml)'
        }

        const { filePath, canceled } = await dialog.showSaveDialog(window, {
          title: 'Export Missing Parts',
          defaultPath: `missing_parts_${sessionId}.${ext}`,
          filters: [{ name: filterLabel, extensions: [ext] }]
        })

        if (canceled || !filePath) {
          return { success: true, canceled: true }
        }

        exportMissingParts({
          sessionId,
          filePath,
          format,
          filter
        })

        return { success: true, filePath, canceled: false }
      } catch (error: any) {
        console.error('Error exporting missing parts:', error)
        return { success: false, error: error.message }
      }
    }
  )
}
