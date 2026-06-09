import { ipcMain } from 'electron'
import {
  createSession,
  getSession,
  updateCountedQty,
  updateItemNotes,
  updateSessionNotes,
  updateSessionStatus,
  quickCompleteSession,
  duplicateSession,
  deleteSession,
  getCollectionOverview,
  getRecentSessions,
  getGeneralStats,
  saveSetNotes,
  addToCollection,
  removeFromCollection,
  isSetInCollection
} from '../services/sessionService'

export function registerSessionHandlers(): void {
  ipcMain.handle('create-session', async (_event, input: any) => {
    try {
      const sessionId = createSession(input)
      return { success: true, sessionId }
    } catch (error: any) {
      console.error('Error creating session:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('get-session', async (_event, sessionId: number) => {
    try {
      const data = getSession(sessionId)
      if (!data) {
        return { success: false, error: `Session ${sessionId} not found.` }
      }
      return { success: true, ...data }
    } catch (error: any) {
      console.error('Error fetching session:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('update-counted-qty', async (_event, itemId: number, countedQty: number | null) => {
    try {
      updateCountedQty(itemId, countedQty)
      return { success: true }
    } catch (error: any) {
      console.error('Error updating counted quantity:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('update-item-notes', async (_event, itemId: number, notes: string | null) => {
    try {
      updateItemNotes(itemId, notes)
      return { success: true }
    } catch (error: any) {
      console.error('Error updating item notes:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('update-session-notes', async (_event, sessionId: number, notes: string | null) => {
    try {
      updateSessionNotes(sessionId, notes)
      return { success: true }
    } catch (error: any) {
      console.error('Error updating session notes:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('update-session-status', async (_event, sessionId: number, status: string) => {
    try {
      updateSessionStatus(sessionId, status)
      return { success: true }
    } catch (error: any) {
      console.error('Error updating session status:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('quick-complete-session', async (_event, sessionId: number) => {
    try {
      quickCompleteSession(sessionId)
      return { success: true }
    } catch (error: any) {
      console.error('Error quick completing session:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('duplicate-session', async (_event, sessionId: number, newName: string) => {
    try {
      const newSessionId = duplicateSession(sessionId, newName)
      return { success: true, sessionId: newSessionId }
    } catch (error: any) {
      console.error('Error duplicating session:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('delete-session', async (_event, sessionId: number) => {
    try {
      deleteSession(sessionId)
      return { success: true }
    } catch (error: any) {
      console.error('Error deleting session:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('save-set-notes', async (_event, setNum: string, notes: string) => {
    try {
      saveSetNotes(setNum, notes)
      return { success: true }
    } catch (error: any) {
      console.error('Error saving set notes:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('get-collection-overview', async () => {
    try {
      const collection = getCollectionOverview()
      return { success: true, collection }
    } catch (error: any) {
      console.error('Error loading collection overview:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('get-recent-sessions', async () => {
    try {
      const sessions = getRecentSessions()
      return { success: true, sessions }
    } catch (error: any) {
      console.error('Error loading recent sessions:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('get-general-stats', async () => {
    try {
      const stats = getGeneralStats()
      return { success: true, stats }
    } catch (error: any) {
      console.error('Error loading general stats:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('add-to-collection', async (_event, setNum: string) => {
    try {
      addToCollection(setNum)
      return { success: true }
    } catch (error: any) {
      console.error('Error adding to collection:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('remove-from-collection', async (_event, setNum: string) => {
    try {
      removeFromCollection(setNum)
      return { success: true }
    } catch (error: any) {
      console.error('Error removing from collection:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('is-set-in-collection', async (_event, setNum: string) => {
    try {
      const isIn = isSetInCollection(setNum)
      return { success: true, isIn }
    } catch (error: any) {
      console.error('Error checking collection state:', error)
      return { success: false, error: error.message }
    }
  })
}
