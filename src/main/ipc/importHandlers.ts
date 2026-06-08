import { ipcMain, dialog, BrowserWindow } from 'electron'
import { importCsvFile } from '../importers/csvImportService'

export function registerImportHandlers(): void {
  ipcMain.handle('import-csv', async (event, filePath: string, type: any) => {
    try {
      console.log(`Starting CSV import: ${type} from ${filePath}`)
      const result = await importCsvFile(filePath, type, (progress) => {
        // Send progress updates to the renderer window
        event.sender.send('import-progress', { type, current: progress.current })
      })
      console.log(`Finished CSV import: ${type}. Success: ${result.successCount}, Errors: ${result.errorCount}`)
      return { success: true, result }
    } catch (error: any) {
      console.error(`Error importing CSV: ${type}`, error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('select-csv-file', async (event) => {
    try {
      const window = BrowserWindow.fromWebContents(event.sender)
      if (!window) throw new Error('No window found for dialog.')

      const { filePaths, canceled } = await dialog.showOpenDialog(window, {
        title: 'Select Rebrickable CSV File',
        properties: ['openFile'],
        filters: [{ name: 'CSV Files (*.csv)', extensions: ['csv'] }]
      })

      if (canceled || filePaths.length === 0) {
        return null
      }
      return filePaths[0]
    } catch (error) {
      console.error('Error in select-csv-file handler:', error)
      return null
    }
  })
}
