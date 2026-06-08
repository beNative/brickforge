import { ipcMain } from 'electron'
import { readAppDocument } from '../services/documentService'

export function registerDocumentHandlers(): void {
  ipcMain.handle('read-document', (_event, docName: 'manual' | 'changelog') => {
    try {
      const content = readAppDocument(docName)
      return { success: true, content }
    } catch (error: any) {
      console.error('read-document error:', error)
      return { success: false, error: error.message }
    }
  })
}
