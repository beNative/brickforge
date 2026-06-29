import { ElectronAPI } from '@electron-toolkit/preload'

export interface BrickForgeAPI {
  getAppVersion: () => Promise<string>
  getSettings: () => Promise<{
    success: boolean
    settings?: { dbFolder: string; dbName: string; autoUpdateEnabled: boolean }
    error?: string
  }>
  updateSettings: (settings: {
    dbFolder: string
    dbName: string
    autoUpdateEnabled: boolean
  }) => Promise<{ success: boolean; error?: string }>
  selectDbFolder: () => Promise<string | null>
  backupDatabase: () => Promise<{ success: boolean; error?: string }>
  restoreDatabase: () => Promise<{ success: boolean; error?: string }>
  vacuumDatabase: () => Promise<{ success: boolean; error?: string }>
  reindexDatabase: () => Promise<{ success: boolean; error?: string }>
  checkForUpdates: () => Promise<{
    success: boolean
    updateAvailable?: boolean
    version?: string
    error?: string
  }>
  importCsv: (
    filePath: string,
    type: string
  ) => Promise<{ success: boolean; error?: string; result?: any }>
  selectCsvFile: () => Promise<string | null>
  minimizeWindow: () => Promise<void>
  maximizeWindow: () => Promise<void>
  closeWindow: () => Promise<void>
  onImportProgress: (callback: (data: { type: string; current: number }) => void) => () => void
  searchSets: (query: string) => Promise<{ success: boolean; error?: string; sets?: any[] }>
  getSetDetails: (setNum: string) => Promise<{ success: boolean; error?: string; details?: any }>
  createSession: (input: any) => Promise<{ success: boolean; error?: string; sessionId?: number }>
  getSession: (
    sessionId: number
  ) => Promise<{ success: boolean; error?: string; session?: any; items?: any[]; progress?: any }>
  updateCountedQty: (
    itemId: number,
    countedQty: number | null
  ) => Promise<{ success: boolean; error?: string }>
  updateExpectedQty: (
    itemId: number,
    expectedQty: number
  ) => Promise<{ success: boolean; error?: string }>
  updateItemNotes: (
    itemId: number,
    notes: string | null
  ) => Promise<{ success: boolean; error?: string }>
  updateSessionNotes: (
    sessionId: number,
    notes: string | null
  ) => Promise<{ success: boolean; error?: string }>
  updateSessionStatus: (
    sessionId: number,
    status: string
  ) => Promise<{ success: boolean; error?: string }>
  quickCompleteSession: (sessionId: number) => Promise<{ success: boolean; error?: string }>
  duplicateSession: (
    sessionId: number,
    newName: string
  ) => Promise<{ success: boolean; error?: string; sessionId?: number }>
  deleteSession: (sessionId: number) => Promise<{ success: boolean; error?: string }>
  saveSetNotes: (setNum: string, notes: string) => Promise<{ success: boolean; error?: string }>
  getCollectionOverview: () => Promise<{ success: boolean; error?: string; collection?: any[] }>
  getRecentSessions: () => Promise<{ success: boolean; error?: string; sessions?: any[] }>
  getGeneralStats: () => Promise<{ success: boolean; error?: string; stats?: any }>
  exportMissingParts: (
    sessionId: number,
    format: 'csv' | 'json' | 'xml',
    filter: 'all_missing' | 'non_spares_missing' | 'spares_missing'
  ) => Promise<{ success: boolean; error?: string; filePath?: string; canceled?: boolean }>
  addToCollection: (setNum: string) => Promise<{ success: boolean; error?: string }>
  setCollectionManualComplete: (
    setNum: string,
    complete: boolean
  ) => Promise<{ success: boolean; error?: string }>
  removeFromCollection: (setNum: string) => Promise<{ success: boolean; error?: string }>
  isSetInCollection: (
    setNum: string
  ) => Promise<{ success: boolean; error?: string; isIn?: boolean }>
  getSetParts: (setNum: string) => Promise<{ success: boolean; error?: string; parts?: any[] }>
  readDocument: (
    docName: 'manual' | 'changelog'
  ) => Promise<{ success: boolean; content?: string; error?: string }>
  downloadSetImages: (setNum: string) => Promise<{
    success: boolean
    error?: string
    stats?: { total: number; downloaded: number; failed: number; skipped: number }
  }>
  downloadCollectionImages: () => Promise<{
    success: boolean
    error?: string
    stats?: { totalSets: number; totalImages: number; totalDownloaded: number; totalFailed: number }
  }>
  getImageCacheStats: () => Promise<{
    success: boolean
    error?: string
    stats?: { totalImages: number; totalSizeBytes: number }
  }>
  clearImageCache: () => Promise<{ success: boolean; error?: string }>
  onImageDownloadProgress: (
    callback: (data: {
      setNum: string
      total: number
      completed: number
      failed: number
      phase: string
    }) => void
  ) => () => void
  onCollectionImageDownloadProgress: (
    callback: (data: {
      totalSets: number
      completedSets: number
      currentSet: string
      imageProgress: any
    }) => void
  ) => () => void
  onUpdateAvailable: (
    callback: (info: { version: string; releaseDate: string }) => void
  ) => () => void
  onUpdateProgress: (
    callback: (data: {
      percent: number
      bytesPerSecond: number
      transferred: number
      total: number
    }) => void
  ) => () => void
  onUpdateDownloaded: (callback: (info: { version: string }) => void) => () => void
  onUpdateError: (callback: (errorMsg: string) => void) => () => void
  triggerUpdateRelaunch: () => Promise<void>
  log: (
    level: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR',
    message: string
  ) => Promise<{ success: boolean; error?: string }>
  getLogs: () => Promise<{ success: boolean; logs: any[]; error?: string }>
  clearLogs: () => Promise<{ success: boolean; error?: string }>
  openLogFolder: () => Promise<{ success: boolean; error?: string }>
  onLogMessage: (callback: (logObj: any) => void) => () => void
  onLogsCleared: (callback: () => void) => () => void
  syncGoogleConnect: (
    clientId: string,
    clientSecret: string
  ) => Promise<{ success: boolean; email?: string; error?: string }>
  syncGoogleDisconnect: () => Promise<{ success: boolean; error?: string }>
  syncRun: (options?: { forcePush?: boolean; forcePull?: boolean }) => Promise<{
    success: boolean
    code?: 'in_sync' | 'pushed' | 'pulled' | 'conflict' | 'error'
    message?: string
    localStats?: any
    remoteStats?: any
    error?: string
  }>
  syncResolveConflict: (
    resolution: 'local' | 'remote'
  ) => Promise<{ success: boolean; error?: string; message?: string }>
  syncGetStatus: () => Promise<{
    success: boolean
    email: string | null
    enabled: boolean
    lastCompletedAt: string | null
    status?: 'idle' | 'syncing' | 'error' | 'conflict'
    conflictStats?: { localStats: any; remoteStats: any } | null
  }>
  syncGetConfig: () => Promise<{
    syncEnabled: boolean
    clientId: string
    clientSecret: string
    email: string | null
    refreshToken: string | null
    syncAutoOnOpenClose: boolean
    conflictResolution: 'ask' | 'prefer-local' | 'prefer-cloud'
    lastLocalChecksum: string | null
    lastRemoteChecksum: string | null
    lastCompletedAt: string | null
    syncDatabaseName: string
  }>
  syncSaveConfig: (config: any) => Promise<{ success: boolean; error?: string }>
  syncListRemoteDatabases: () => Promise<{
    success: boolean
    files?: { name: string; id: string; modifiedTime: string }[]
    error?: string
  }>
  onSyncStatus: (
    callback: (payload: {
      status: 'idle' | 'syncing' | 'error' | 'conflict'
      message?: string
    }) => void
  ) => () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: BrickForgeAPI
  }
}
