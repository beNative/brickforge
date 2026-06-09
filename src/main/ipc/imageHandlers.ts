import { ipcMain } from 'electron'
import {
  downloadAndCacheSetImages,
  downloadCollectionImages,
  getImageCacheStats,
  clearImageCache
} from '../services/imageService'

export function registerImageHandlers(): void {
  ipcMain.handle('download-set-images', async (event, setNum: string) => {
    try {
      const sender = event.sender
      const stats = await downloadAndCacheSetImages(setNum, (progress) => {
        try {
          sender.send('image-download-progress', progress)
        } catch {
          // Window may have been closed
        }
      })
      return { success: true, stats }
    } catch (error: any) {
      console.error('download-set-images error:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('download-collection-images', async (event) => {
    try {
      const sender = event.sender
      const stats = await downloadCollectionImages((progress) => {
        try {
          sender.send('collection-image-download-progress', progress)
        } catch {
          // Window may have been closed
        }
      })
      return { success: true, stats }
    } catch (error: any) {
      console.error('download-collection-images error:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('get-image-cache-stats', () => {
    try {
      const stats = getImageCacheStats()
      return { success: true, stats }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('clear-image-cache', () => {
    try {
      clearImageCache()
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })
}
