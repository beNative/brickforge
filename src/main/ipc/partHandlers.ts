import { ipcMain } from 'electron'
import { searchParts, getPartDetails, getTechnicGroups } from '../services/partService'

export function registerPartHandlers(): void {
  ipcMain.handle(
    'parts:search',
    async (_event, query: string, groupId: number | null, limit: number, offset: number) => {
      try {
        const result = searchParts(query, groupId, limit, offset)
        return { success: true, ...result }
      } catch (error: any) {
        console.error('Error searching parts:', error)
        return { success: false, error: error.message }
      }
    }
  )

  ipcMain.handle('parts:get-details', async (_event, partNum: string) => {
    try {
      const result = getPartDetails(partNum)
      if (!result) {
        return { success: false, error: `Part ${partNum} not found` }
      }
      return { success: true, ...result }
    } catch (error: any) {
      console.error('Error getting part details:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('parts:get-technic-groups', async () => {
    try {
      const groups = getTechnicGroups()
      return { success: true, groups }
    } catch (error: any) {
      console.error('Error getting technic groups:', error)
      return { success: false, error: error.message }
    }
  })
}
