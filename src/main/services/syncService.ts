import { app, BrowserWindow } from 'electron'
import { join, dirname } from 'path'
import fs from 'fs/promises'
import { existsSync } from 'fs'
import crypto from 'crypto'
import os from 'os'
import { GoogleDriveService } from './gdriveService'
import {
  getDatabasePath,
  closeDatabase,
  initDatabase,
  backupDatabase,
  getDatabaseStatsForFile
} from '../database/connection'
import { info, error } from './loggerService'

export interface SyncConfig {
  syncEnabled?: boolean
  clientId?: string
  clientSecret?: string
  refreshToken?: string
  email?: string | null
  syncAutoOnOpenClose?: boolean
  conflictResolution?: 'ask' | 'prefer-local' | 'prefer-cloud'
  lastLocalChecksum?: string | null
  lastRemoteChecksum?: string | null
  lastCompletedAt?: string | null
  syncDatabaseName?: string
}

let syncConfig: SyncConfig = {}
const SYNC_CONFIG_FILE = 'sync-config.json'
const getSyncConfigFilePath = () => join(app.getPath('userData'), SYNC_CONFIG_FILE)

export async function loadSyncConfig(): Promise<SyncConfig> {
  try {
    const raw = await fs.readFile(getSyncConfigFilePath(), 'utf-8')
    syncConfig = JSON.parse(raw) as SyncConfig
    info('[Sync] Local sync-config.json loaded.')
  } catch (err) {
    syncConfig = {
      syncEnabled: false,
      clientId: '',
      clientSecret: '',
      syncAutoOnOpenClose: false,
      conflictResolution: 'ask',
      syncDatabaseName: 'brickforge.db'
    }
    info('[Sync] Initialized default sync configuration.')
  }
  return syncConfig
}

export function getSyncConfig(): SyncConfig {
  return syncConfig
}

export async function saveSyncConfig(): Promise<void> {
  try {
    const configPath = getSyncConfigFilePath()
    await fs.mkdir(dirname(configPath), { recursive: true })
    await fs.writeFile(configPath, JSON.stringify(syncConfig, null, 2), 'utf-8')
  } catch (err) {
    error('[Sync] Failed to save sync-config.json:', err)
  }
}

let periodicSyncTimer: NodeJS.Timeout | null = null
let syncStatus: 'idle' | 'syncing' | 'error' | 'conflict' = 'idle'
let activeOAuthServerCloseFn: (() => void) | null = null

export function getSyncStatus(): 'idle' | 'syncing' | 'error' | 'conflict' {
  return syncStatus
}

export function setOAuthServerCloseFn(closeFn: (() => void) | null) {
  if (activeOAuthServerCloseFn) {
    try {
      activeOAuthServerCloseFn()
    } catch (e) {
      error('[Sync] Error closing active OAuth server:', e)
    }
  }
  activeOAuthServerCloseFn = closeFn
}

export function getOAuthServerCloseFn() {
  return activeOAuthServerCloseFn
}

export function broadcastSyncStatus(payload: { status: string; message?: string }) {
  const windows = BrowserWindow.getAllWindows()
  for (const win of windows) {
    if (!win.isDestroyed()) {
      win.webContents.send('sync:status', payload)
    }
  }
}

export function startPeriodicSync(): void {
  stopPeriodicSync()
  if (syncConfig.syncEnabled && syncConfig.refreshToken) {
    info('[Sync] Starting periodic cloud sync (every 10 minutes).')
    periodicSyncTimer = setInterval(() => {
      info('[Sync] Running periodic background sync...')
      runSyncInternal().catch((err) => error('[Sync] Periodic sync error:', err))
    }, 10 * 60 * 1000)
  }
}

export function stopPeriodicSync(): void {
  if (periodicSyncTimer) {
    clearInterval(periodicSyncTimer)
    periodicSyncTimer = null
    info('[Sync] Periodic cloud sync stopped.')
  }
}

async function getFileChecksum(filePath: string): Promise<string> {
  const content = await fs.readFile(filePath)
  return crypto.createHash('md5').update(content).digest('hex')
}

export async function runSyncInternal(options?: {
  forcePush?: boolean
  forcePull?: boolean
}): Promise<{
  success: boolean
  code?: 'in_sync' | 'pushed' | 'pulled' | 'conflict' | 'error'
  message?: string
  localStats?: any
  remoteStats?: any
  error?: string
}> {
  if (syncStatus === 'syncing') {
    return { success: false, error: 'Sync is already in progress.' }
  }

  if (
    !syncConfig.syncEnabled ||
    !syncConfig.clientId ||
    !syncConfig.clientSecret ||
    !syncConfig.refreshToken
  ) {
    return { success: false, error: 'Cloud sync is not fully configured or is disabled.' }
  }

  syncStatus = 'syncing'
  broadcastSyncStatus({ status: 'syncing', message: 'Authenticating with Google...' })

  let tempBackupPath = ''
  try {
    // 1. Refresh token
    const refreshRes = await GoogleDriveService.refreshAccessToken(
      syncConfig.clientId,
      syncConfig.clientSecret,
      syncConfig.refreshToken
    )
    const accessToken = refreshRes.accessToken

    // 2. Local backup snapshot (prevents file locking issues during uploads)
    broadcastSyncStatus({ status: 'syncing', message: 'Creating database snapshot...' })
    const localDbPath = getDatabasePath()
    
    if (!existsSync(localDbPath)) {
      // If the local database doesn't exist yet, we will pull or create it
      info('[Sync] Local database file does not exist yet.')
    }

    tempBackupPath = join(os.tmpdir(), `brickforge_sync_${Date.now()}.db`)
    
    let localExists = existsSync(localDbPath)
    if (localExists) {
      await backupDatabase(tempBackupPath)
    }

    const localChecksum = localExists ? await getFileChecksum(tempBackupPath) : ''

    // 3. Search remote file
    broadcastSyncStatus({ status: 'syncing', message: 'Checking Google Drive...' })
    const dbName = syncConfig.syncDatabaseName || 'brickforge.db'
    const cloudFile = await GoogleDriveService.findDatabaseFile(accessToken, dbName)

    if (!cloudFile) {
      if (!localExists) {
        // Neither local nor remote database exists! Create local first.
        initDatabase()
        localExists = true
        await backupDatabase(tempBackupPath)
      }
      
      // Upload local to remote (since remote doesn't exist)
      broadcastSyncStatus({ status: 'syncing', message: 'Uploading database to cloud...' })
      const uploaded = await GoogleDriveService.uploadDatabaseFile(accessToken, tempBackupPath, dbName)

      syncConfig.lastLocalChecksum = await getFileChecksum(tempBackupPath)
      syncConfig.lastRemoteChecksum = uploaded.md5Checksum
      syncConfig.lastCompletedAt = new Date().toISOString()
      await saveSyncConfig()

      await fs.unlink(tempBackupPath).catch(() => {})
      syncStatus = 'idle'
      broadcastSyncStatus({ status: 'idle', message: 'Pushed local database to cloud.' })
      return { success: true, code: 'pushed', message: 'Pushed local database to cloud.' }
    }

    if (!localExists) {
      // Remote exists, local doesn't. Pull remote file.
      broadcastSyncStatus({ status: 'syncing', message: 'Downloading cloud database...' })
      await fs.mkdir(dirname(localDbPath), { recursive: true })
      await GoogleDriveService.downloadDatabaseFile(accessToken, cloudFile.id, localDbPath)
      initDatabase()

      const newChecksum = await getFileChecksum(localDbPath)
      syncConfig.lastLocalChecksum = newChecksum
      syncConfig.lastRemoteChecksum = cloudFile.md5Checksum
      syncConfig.lastCompletedAt = new Date().toISOString()
      await saveSyncConfig()

      syncStatus = 'idle'
      broadcastSyncStatus({ status: 'idle', message: 'Pulled cloud database.' })
      
      // Trigger UI reload
      const windows = BrowserWindow.getAllWindows()
      for (const win of windows) {
        if (!win.isDestroyed()) {
          win.webContents.reload()
        }
      }
      return { success: true, code: 'pulled', message: 'Pulled cloud database.' }
    }

    // Compare checksums
    const localChanged = localChecksum !== syncConfig.lastLocalChecksum
    const remoteChanged = cloudFile.md5Checksum !== syncConfig.lastRemoteChecksum

    // Handle force configurations
    if (options?.forcePush) {
      broadcastSyncStatus({ status: 'syncing', message: 'Force uploading database...' })
      const updated = await GoogleDriveService.updateDatabaseFile(accessToken, cloudFile.id, tempBackupPath)

      syncConfig.lastLocalChecksum = localChecksum
      syncConfig.lastRemoteChecksum = updated.md5Checksum
      syncConfig.lastCompletedAt = new Date().toISOString()
      await saveSyncConfig()

      await fs.unlink(tempBackupPath).catch(() => {})
      syncStatus = 'idle'
      broadcastSyncStatus({ status: 'idle', message: 'Force pushed database.' })
      return { success: true, code: 'pushed', message: 'Force pushed database.' }
    }

    if (options?.forcePull) {
      broadcastSyncStatus({ status: 'syncing', message: 'Downloading cloud database...' })
      const downloadPath = join(os.tmpdir(), `brickforge_download_${Date.now()}.db`)
      await GoogleDriveService.downloadDatabaseFile(accessToken, cloudFile.id, downloadPath)

      broadcastSyncStatus({ status: 'syncing', message: 'Applying cloud database...' })
      closeDatabase()
      await fs.copyFile(downloadPath, localDbPath)
      initDatabase()

      await fs.unlink(downloadPath).catch(() => {})
      await fs.unlink(tempBackupPath).catch(() => {})

      const newLocalChecksum = await getFileChecksum(localDbPath)
      syncConfig.lastLocalChecksum = newLocalChecksum
      syncConfig.lastRemoteChecksum = cloudFile.md5Checksum
      syncConfig.lastCompletedAt = new Date().toISOString()
      await saveSyncConfig()

      syncStatus = 'idle'
      broadcastSyncStatus({ status: 'idle', message: 'Force pulled database.' })

      // Reload UI
      const windows = BrowserWindow.getAllWindows()
      for (const win of windows) {
        if (!win.isDestroyed()) {
          win.webContents.reload()
        }
      }

      return { success: true, code: 'pulled', message: 'Force pulled database.' }
    }

    // Check changes logic
    if (!localChanged && !remoteChanged) {
      syncConfig.lastCompletedAt = new Date().toISOString()
      await saveSyncConfig()
      await fs.unlink(tempBackupPath).catch(() => {})
      syncStatus = 'idle'
      broadcastSyncStatus({ status: 'idle', message: 'In sync.' })
      return { success: true, code: 'in_sync', message: 'Database is in sync.' }
    }

    if (localChanged && !remoteChanged) {
      // Push local edits
      broadcastSyncStatus({ status: 'syncing', message: 'Uploading local changes...' })
      const updated = await GoogleDriveService.updateDatabaseFile(accessToken, cloudFile.id, tempBackupPath)

      syncConfig.lastLocalChecksum = localChecksum
      syncConfig.lastRemoteChecksum = updated.md5Checksum
      syncConfig.lastCompletedAt = new Date().toISOString()
      await saveSyncConfig()

      await fs.unlink(tempBackupPath).catch(() => {})
      syncStatus = 'idle'
      broadcastSyncStatus({ status: 'idle', message: 'Uploaded local changes.' })
      return { success: true, code: 'pushed', message: 'Local changes pushed to Google Drive.' }
    }

    if (!localChanged && remoteChanged) {
      // Pull remote edits
      broadcastSyncStatus({ status: 'syncing', message: 'Downloading cloud changes...' })
      const downloadPath = join(os.tmpdir(), `brickforge_download_${Date.now()}.db`)
      await GoogleDriveService.downloadDatabaseFile(accessToken, cloudFile.id, downloadPath)

      broadcastSyncStatus({ status: 'syncing', message: 'Applying cloud changes...' })
      closeDatabase()
      await fs.copyFile(downloadPath, localDbPath)
      initDatabase()

      await fs.unlink(downloadPath).catch(() => {})
      await fs.unlink(tempBackupPath).catch(() => {})

      const newLocalChecksum = await getFileChecksum(localDbPath)
      syncConfig.lastLocalChecksum = newLocalChecksum
      syncConfig.lastRemoteChecksum = cloudFile.md5Checksum
      syncConfig.lastCompletedAt = new Date().toISOString()
      await saveSyncConfig()

      syncStatus = 'idle'
      broadcastSyncStatus({ status: 'idle', message: 'Downloaded cloud changes.' })

      // Reload UI
      const windows = BrowserWindow.getAllWindows()
      for (const win of windows) {
        if (!win.isDestroyed()) {
          win.webContents.reload()
        }
      }

      return { success: true, code: 'pulled', message: 'Downloaded cloud changes.' }
    }

    // Both changed: Conflict!
    if (syncConfig.conflictResolution === 'prefer-local') {
      info('[Sync] Conflict resolution: Prefer Local. Overwriting cloud...')
      const updated = await GoogleDriveService.updateDatabaseFile(accessToken, cloudFile.id, tempBackupPath)
      syncConfig.lastLocalChecksum = localChecksum
      syncConfig.lastRemoteChecksum = updated.md5Checksum
      syncConfig.lastCompletedAt = new Date().toISOString()
      await saveSyncConfig()
      await fs.unlink(tempBackupPath).catch(() => {})
      syncStatus = 'idle'
      broadcastSyncStatus({ status: 'idle', message: 'Conflict resolved: kept local.' })
      return { success: true, code: 'pushed', message: 'Conflict resolved: kept local.' }
    }

    if (syncConfig.conflictResolution === 'prefer-cloud') {
      info('[Sync] Conflict resolution: Prefer Cloud. Overwriting local...')
      const downloadPath = join(os.tmpdir(), `brickforge_download_${Date.now()}.db`)
      await GoogleDriveService.downloadDatabaseFile(accessToken, cloudFile.id, downloadPath)
      closeDatabase()
      await fs.copyFile(downloadPath, localDbPath)
      initDatabase()
      await fs.unlink(downloadPath).catch(() => {})
      await fs.unlink(tempBackupPath).catch(() => {})

      const newLocalChecksum = await getFileChecksum(localDbPath)
      syncConfig.lastLocalChecksum = newLocalChecksum
      syncConfig.lastRemoteChecksum = cloudFile.md5Checksum
      syncConfig.lastCompletedAt = new Date().toISOString()
      await saveSyncConfig()

      syncStatus = 'idle'
      broadcastSyncStatus({ status: 'idle', message: 'Conflict resolved: kept cloud.' })

      // Reload UI
      const windows = BrowserWindow.getAllWindows()
      for (const win of windows) {
        if (!win.isDestroyed()) {
          win.webContents.reload()
        }
      }

      return { success: true, code: 'pulled', message: 'Conflict resolved: kept cloud.' }
    }

    // Ask user: Download remote database to inspect stats
    info('[Sync] Conflict detected. Downloading cloud version to retrieve statistics...')
    const conflictDownloadPath = join(os.tmpdir(), `brickforge_conflict_${Date.now()}.db`)
    await GoogleDriveService.downloadDatabaseFile(accessToken, cloudFile.id, conflictDownloadPath)

    const remoteStats = getDatabaseStatsForFile(conflictDownloadPath)
    await fs.unlink(conflictDownloadPath).catch(() => {})
    const localStats = getDatabaseStatsForFile(localDbPath)
    await fs.unlink(tempBackupPath).catch(() => {})

    syncStatus = 'conflict'
    broadcastSyncStatus({ status: 'conflict', message: 'Conflict detected.' })

    return {
      success: true,
      code: 'conflict',
      message: 'Conflict detected.',
      localStats,
      remoteStats
    }
  } catch (err: any) {
    if (tempBackupPath) {
      await fs.unlink(tempBackupPath).catch(() => {})
    }
    error('[Sync] Sync execution failed:', err)
    syncStatus = 'error'
    broadcastSyncStatus({ status: 'error', message: err.message || 'Sync failed.' })
    return { success: false, error: err.message || 'Sync failed.' }
  }
}
