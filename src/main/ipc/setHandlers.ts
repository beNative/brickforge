import { ipcMain } from 'electron'
import { searchSets, getSetDetails, getSetParts } from '../services/setService'

export function registerSetHandlers(): void {
  ipcMain.handle('search-sets', async (_event, query: string) => {
    try {
      return { success: true, sets: searchSets(query) }
    } catch (error: any) {
      console.error('Error in search-sets handler:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('get-set-details', async (_event, setNum: string) => {
    try {
      const details = getSetDetails(setNum)
      if (!details) {
        return { success: false, error: `Set ${setNum} not found.` }
      }
      return { success: true, details }
    } catch (error: any) {
      console.error('Error in get-set-details handler:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('get-set-parts', async (_event, setNum: string) => {
    try {
      const parts = getSetParts(setNum)
      return { success: true, parts }
    } catch (error: any) {
      console.error('Error in get-set-parts handler:', error)
      return { success: false, error: error.message }
    }
  })
}
