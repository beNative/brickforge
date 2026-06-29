import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  updateSettings: (settings: any) => ipcRenderer.invoke('update-settings', settings),
  selectDbFolder: () => ipcRenderer.invoke('select-db-folder'),
  backupDatabase: () => ipcRenderer.invoke('database-backup'),
  restoreDatabase: () => ipcRenderer.invoke('database-restore'),
  vacuumDatabase: () => ipcRenderer.invoke('database-vacuum'),
  reindexDatabase: () => ipcRenderer.invoke('database-reindex'),
  checkForUpdates: () => ipcRenderer.invoke('update-check-now'),

  importCsv: (filePath: string, type: string) => ipcRenderer.invoke('import-csv', filePath, type),

  selectCsvFile: () => ipcRenderer.invoke('select-csv-file'),

  minimizeWindow: () => ipcRenderer.invoke('window-minimize'),

  maximizeWindow: () => ipcRenderer.invoke('window-maximize'),

  closeWindow: () => ipcRenderer.invoke('window-close'),

  onImportProgress: (callback: (data: { type: string; current: number }) => void) => {
    const listener = (_event: any, data: any) => callback(data)
    ipcRenderer.on('import-progress', listener)
    return () => {
      ipcRenderer.removeListener('import-progress', listener)
    }
  },

  searchSets: (query: string) => ipcRenderer.invoke('search-sets', query),

  getSetDetails: (setNum: string) => ipcRenderer.invoke('get-set-details', setNum),

  createSession: (input: any) => ipcRenderer.invoke('create-session', input),

  getSession: (sessionId: number) => ipcRenderer.invoke('get-session', sessionId),

  updateCountedQty: (itemId: number, countedQty: number | null) =>
    ipcRenderer.invoke('update-counted-qty', itemId, countedQty),

  updateExpectedQty: (itemId: number, expectedQty: number) =>
    ipcRenderer.invoke('update-expected-qty', itemId, expectedQty),

  updateItemNotes: (itemId: number, notes: string | null) =>
    ipcRenderer.invoke('update-item-notes', itemId, notes),

  updateSessionNotes: (sessionId: number, notes: string | null) =>
    ipcRenderer.invoke('update-session-notes', sessionId, notes),

  updateSessionStatus: (sessionId: number, status: string) =>
    ipcRenderer.invoke('update-session-status', sessionId, status),

  quickCompleteSession: (sessionId: number) =>
    ipcRenderer.invoke('quick-complete-session', sessionId),

  duplicateSession: (sessionId: number, newName: string) =>
    ipcRenderer.invoke('duplicate-session', sessionId, newName),

  deleteSession: (sessionId: number) => ipcRenderer.invoke('delete-session', sessionId),

  saveSetNotes: (setNum: string, notes: string) =>
    ipcRenderer.invoke('save-set-notes', setNum, notes),

  getCollectionOverview: () => ipcRenderer.invoke('get-collection-overview'),

  getRecentSessions: () => ipcRenderer.invoke('get-recent-sessions'),

  getGeneralStats: () => ipcRenderer.invoke('get-general-stats'),

  exportMissingParts: (
    sessionId: number,
    format: 'csv' | 'json' | 'xml',
    filter: 'all_missing' | 'non_spares_missing' | 'spares_missing'
  ) => ipcRenderer.invoke('export-missing-parts', sessionId, format, filter),

  addToCollection: (setNum: string) => ipcRenderer.invoke('add-to-collection', setNum),

  setCollectionManualComplete: (setNum: string, complete: boolean) =>
    ipcRenderer.invoke('set-collection-manual-complete', setNum, complete),

  removeFromCollection: (setNum: string) => ipcRenderer.invoke('remove-from-collection', setNum),

  isSetInCollection: (setNum: string) => ipcRenderer.invoke('is-set-in-collection', setNum),

  getSetParts: (setNum: string) => ipcRenderer.invoke('get-set-parts', setNum),

  readDocument: (docName: 'manual' | 'changelog') => ipcRenderer.invoke('read-document', docName),

  downloadSetImages: (setNum: string) => ipcRenderer.invoke('download-set-images', setNum),

  downloadCollectionImages: () => ipcRenderer.invoke('download-collection-images'),

  getImageCacheStats: () => ipcRenderer.invoke('get-image-cache-stats'),

  clearImageCache: () => ipcRenderer.invoke('clear-image-cache'),

  onImageDownloadProgress: (callback: (data: any) => void) => {
    const listener = (_event: any, data: any) => callback(data)
    ipcRenderer.on('image-download-progress', listener)
    return () => {
      ipcRenderer.removeListener('image-download-progress', listener)
    }
  },

  onCollectionImageDownloadProgress: (callback: (data: any) => void) => {
    const listener = (_event: any, data: any) => callback(data)
    ipcRenderer.on('collection-image-download-progress', listener)
    return () => {
      ipcRenderer.removeListener('collection-image-download-progress', listener)
    }
  },

  onUpdateAvailable: (callback: (info: { version: string; releaseDate: string }) => void) => {
    const listener = (_event: any, data: any) => callback(data)
    ipcRenderer.on('update-available', listener)
    return () => {
      ipcRenderer.removeListener('update-available', listener)
    }
  },

  onUpdateProgress: (
    callback: (data: {
      percent: number
      bytesPerSecond: number
      transferred: number
      total: number
    }) => void
  ) => {
    const listener = (_event: any, data: any) => callback(data)
    ipcRenderer.on('update-progress', listener)
    return () => {
      ipcRenderer.removeListener('update-progress', listener)
    }
  },

  onUpdateDownloaded: (callback: (info: { version: string }) => void) => {
    const listener = (_event: any, data: any) => callback(data)
    ipcRenderer.on('update-downloaded', listener)
    return () => {
      ipcRenderer.removeListener('update-downloaded', listener)
    }
  },

  onUpdateError: (callback: (errorMsg: string) => void) => {
    const listener = (_event: any, data: any) => callback(data)
    ipcRenderer.on('update-error', listener)
    return () => {
      ipcRenderer.removeListener('update-error', listener)
    }
  },

  triggerUpdateRelaunch: () => ipcRenderer.invoke('update-relaunch'),

  log: (level: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR', message: string) =>
    ipcRenderer.invoke('log', level, message),
  getLogs: () => ipcRenderer.invoke('get-logs'),
  clearLogs: () => ipcRenderer.invoke('clear-logs'),
  openLogFolder: () => ipcRenderer.invoke('open-log-folder'),
  onLogMessage: (callback: (logObj: any) => void) => {
    const listener = (_event: any, data: any) => callback(data)
    ipcRenderer.on('log-message', listener)
    return () => {
      ipcRenderer.removeListener('log-message', listener)
    }
  },
  onLogsCleared: (callback: () => void) => {
    const listener = () => callback()
    ipcRenderer.on('logs-cleared', listener)
    return () => {
      ipcRenderer.removeListener('logs-cleared', listener)
    }
  },

  syncGoogleConnect: (clientId: string, clientSecret: string) =>
    ipcRenderer.invoke('sync:google-connect', clientId, clientSecret),
  syncGoogleDisconnect: () => ipcRenderer.invoke('sync:google-disconnect'),
  syncRun: (options?: { forcePush?: boolean; forcePull?: boolean }) =>
    ipcRenderer.invoke('sync:run', options),
  syncResolveConflict: (resolution: 'local' | 'remote') =>
    ipcRenderer.invoke('sync:resolve-conflict', resolution),
  syncGetStatus: () => ipcRenderer.invoke('sync:get-status'),
  syncGetConfig: () => ipcRenderer.invoke('sync:get-config'),
  syncSaveConfig: (config: any) => ipcRenderer.invoke('sync:save-config', config),
  syncListRemoteDatabases: () => ipcRenderer.invoke('sync:list-remote-dbs'),
  onSyncStatus: (
    callback: (payload: {
      status: 'idle' | 'syncing' | 'error' | 'conflict'
      message?: string
    }) => void
  ) => {
    const listener = (_event: any, data: any) => callback(data)
    ipcRenderer.on('sync:status', listener)
    return () => {
      ipcRenderer.removeListener('sync:status', listener)
    }
  },

  partsSearch: (query: string, groupId: number | null, limit: number, offset: number) =>
    ipcRenderer.invoke('parts:search', query, groupId, limit, offset),

  partsGetDetails: (partNum: string) => ipcRenderer.invoke('parts:get-details', partNum),

  partsGetTechnicGroups: () => ipcRenderer.invoke('parts:get-technic-groups')
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
