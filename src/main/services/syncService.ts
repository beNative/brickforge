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
let lastConflictStats: { localStats: any; remoteStats: any } | null = null

export function getConflictStats(): { localStats: any; remoteStats: any } | null {
  return lastConflictStats
}

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
    periodicSyncTimer = setInterval(
      () => {
        info('[Sync] Running periodic background sync...')
        runSyncInternal().catch((err) => error('[Sync] Periodic sync error:', err))
      },
      10 * 60 * 1000
    )
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
    info('[Sync] Cloud sync is not fully configured or is disabled. Skipping sync run.')
    return { success: false, error: 'Cloud sync is not fully configured or is disabled.' }
  }

  info('[Sync] Starting cloud sync check...')
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
    info('[Sync] Google OAuth authentication successful.')

    // 2. Local backup snapshot (prevents file locking issues during uploads)
    broadcastSyncStatus({ status: 'syncing', message: 'Creating database snapshot...' })
    const localDbPath = getDatabasePath()
    let localExists = existsSync(localDbPath)

    if (localExists) {
      const stats = await fs.stat(localDbPath)
      info(
        `[Sync] Local database file detected: ${localDbPath} (Size: ${(stats.size / 1024).toFixed(2)} KB)`
      )
    } else {
      info(`[Sync] Local database file does not exist at: ${localDbPath}`)
    }

    tempBackupPath = join(os.tmpdir(), `brickforge_sync_${Date.now()}.db`)

    if (localExists) {
      info(`[Sync] Backing up local database to temp snapshot: ${tempBackupPath}`)
      await backupDatabase(tempBackupPath)
    }

    const localChecksum = localExists ? await getFileChecksum(tempBackupPath) : ''
    info(`[Sync] Calculated checksum for local database: ${localChecksum || 'None'}`)
    info(
      `[Sync] Last recorded local checksum in sync config: ${syncConfig.lastLocalChecksum || 'None'}`
    )

    // 3. Search remote file
    broadcastSyncStatus({ status: 'syncing', message: 'Checking Google Drive...' })
    const dbName = syncConfig.syncDatabaseName || 'brickforge.db'
    info(`[Sync] Searching for database file "${dbName}" in Google Drive appDataFolder...`)
    const cloudFile = await GoogleDriveService.findDatabaseFile(accessToken, dbName)

    if (!cloudFile) {
      info(`[Sync] Database "${dbName}" not found in Google Drive appDataFolder.`)
      if (!localExists) {
        info(
          '[Sync] Neither local nor remote database exists. Creating a new empty local database...'
        )
        initDatabase()
        localExists = true
        await backupDatabase(tempBackupPath)
      }

      // Upload local to remote (since remote doesn't exist)
      info(`[Sync] Uploading local database snapshot to Google Drive as "${dbName}"...`)
      broadcastSyncStatus({ status: 'syncing', message: 'Uploading database to cloud...' })
      const uploaded = await GoogleDriveService.uploadDatabaseFile(
        accessToken,
        tempBackupPath,
        dbName
      )
      info(
        `[Sync] Upload successful. Google Drive File ID: ${uploaded.id}, MD5 Checksum: ${uploaded.md5Checksum}`
      )

      syncConfig.lastLocalChecksum = await getFileChecksum(tempBackupPath)
      syncConfig.lastRemoteChecksum = uploaded.md5Checksum
      syncConfig.lastCompletedAt = new Date().toISOString()
      await saveSyncConfig()

      await fs.unlink(tempBackupPath).catch(() => {})
      syncStatus = 'idle'
      broadcastSyncStatus({ status: 'idle', message: 'Pushed local database to cloud.' })
      info('[Sync] Database successfully initialized on cloud. Sync complete.')
      return { success: true, code: 'pushed', message: 'Pushed local database to cloud.' }
    }

    info(
      `[Sync] Remote cloud database found. ID: ${cloudFile.id}, MD5 Checksum: ${cloudFile.md5Checksum}, Last Modified: ${cloudFile.modifiedTime}`
    )
    info(
      `[Sync] Last recorded remote checksum in sync config: ${syncConfig.lastRemoteChecksum || 'None'}`
    )

    if (!localExists) {
      // Remote exists, local doesn't. Pull remote file.
      info(
        `[Sync] Local database is missing. Downloading remote database file (ID: ${cloudFile.id}) to ${localDbPath}...`
      )
      broadcastSyncStatus({ status: 'syncing', message: 'Downloading cloud database...' })
      await fs.mkdir(dirname(localDbPath), { recursive: true })
      await GoogleDriveService.downloadDatabaseFile(accessToken, cloudFile.id, localDbPath)
      info('[Sync] Remote database downloaded successfully. Reinitializing local database...')
      initDatabase()

      const newChecksum = await getFileChecksum(localDbPath)
      syncConfig.lastLocalChecksum = newChecksum
      syncConfig.lastRemoteChecksum = cloudFile.md5Checksum
      syncConfig.lastCompletedAt = new Date().toISOString()
      await saveSyncConfig()

      syncStatus = 'idle'
      broadcastSyncStatus({ status: 'idle', message: 'Pulled cloud database.' })
      info('[Sync] Cloud database successfully applied locally. Sync complete.')

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
    info(`[Sync] Comparison results: localChanged=${localChanged}, remoteChanged=${remoteChanged}`)

    // Handle force configurations
    if (options?.forcePush) {
      info(
        `[Sync] Force push requested. Overwriting remote file (ID: ${cloudFile.id}) with local backup snapshot...`
      )
      lastConflictStats = null
      broadcastSyncStatus({ status: 'syncing', message: 'Force uploading database...' })
      const updated = await GoogleDriveService.updateDatabaseFile(
        accessToken,
        cloudFile.id,
        tempBackupPath
      )
      info(`[Sync] Force upload successful. Updated Cloud MD5 Checksum: ${updated.md5Checksum}`)

      syncConfig.lastLocalChecksum = localChecksum
      syncConfig.lastRemoteChecksum = updated.md5Checksum
      syncConfig.lastCompletedAt = new Date().toISOString()
      await saveSyncConfig()

      await fs.unlink(tempBackupPath).catch(() => {})
      syncStatus = 'idle'
      broadcastSyncStatus({ status: 'idle', message: 'Force pushed database.' })
      info('[Sync] Force push complete.')
      return { success: true, code: 'pushed', message: 'Force pushed database.' }
    }

    if (options?.forcePull) {
      info(
        `[Sync] Force pull requested. Overwriting local database with remote file (ID: ${cloudFile.id})...`
      )
      lastConflictStats = null
      broadcastSyncStatus({ status: 'syncing', message: 'Downloading cloud database...' })
      const downloadPath = join(os.tmpdir(), `brickforge_download_${Date.now()}.db`)
      await GoogleDriveService.downloadDatabaseFile(accessToken, cloudFile.id, downloadPath)
      info(
        '[Sync] Remote database file downloaded. Closing local database and applying cloud data...'
      )

      broadcastSyncStatus({ status: 'syncing', message: 'Applying cloud database...' })
      closeDatabase()
      await fs.copyFile(downloadPath, localDbPath)
      info('[Sync] Database file copy complete. Reinitializing local database...')
      initDatabase()

      await fs.unlink(downloadPath).catch(() => {})
      await fs.unlink(tempBackupPath).catch(() => {})

      const newLocalChecksum = await getFileChecksum(localDbPath)
      info(`[Sync] Force pulled database local checksum: ${newLocalChecksum}`)
      syncConfig.lastLocalChecksum = newLocalChecksum
      syncConfig.lastRemoteChecksum = cloudFile.md5Checksum
      syncConfig.lastCompletedAt = new Date().toISOString()
      await saveSyncConfig()

      syncStatus = 'idle'
      broadcastSyncStatus({ status: 'idle', message: 'Force pulled database.' })
      info('[Sync] Force pull complete.')

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
      info('[Sync] Local and cloud databases are identical. Nothing to do.')
      lastConflictStats = null
      syncConfig.lastCompletedAt = new Date().toISOString()
      await saveSyncConfig()
      await fs.unlink(tempBackupPath).catch(() => {})
      syncStatus = 'idle'
      broadcastSyncStatus({ status: 'idle', message: 'In sync.' })
      info('[Sync] Sync complete. Status: In sync.')
      return { success: true, code: 'in_sync', message: 'Database is in sync.' }
    }

    if (localChanged && !remoteChanged) {
      info(
        '[Sync] Local edits detected, cloud database is unchanged. Uploading local changes to cloud...'
      )
      lastConflictStats = null
      // Push local edits
      broadcastSyncStatus({ status: 'syncing', message: 'Uploading local changes...' })
      const updated = await GoogleDriveService.updateDatabaseFile(
        accessToken,
        cloudFile.id,
        tempBackupPath
      )
      info(`[Sync] Upload successful. Updated Cloud MD5 Checksum: ${updated.md5Checksum}`)

      syncConfig.lastLocalChecksum = localChecksum
      syncConfig.lastRemoteChecksum = updated.md5Checksum
      syncConfig.lastCompletedAt = new Date().toISOString()
      await saveSyncConfig()

      await fs.unlink(tempBackupPath).catch(() => {})
      syncStatus = 'idle'
      broadcastSyncStatus({ status: 'idle', message: 'Uploaded local changes.' })
      info('[Sync] Local database changes successfully synchronized to cloud.')
      return { success: true, code: 'pushed', message: 'Local changes pushed to Google Drive.' }
    }

    if (!localChanged && remoteChanged) {
      info(
        '[Sync] Cloud changes detected, local database is unchanged. Downloading cloud database updates...'
      )
      lastConflictStats = null
      // Pull remote edits
      broadcastSyncStatus({ status: 'syncing', message: 'Downloading cloud changes...' })
      const downloadPath = join(os.tmpdir(), `brickforge_download_${Date.now()}.db`)
      await GoogleDriveService.downloadDatabaseFile(accessToken, cloudFile.id, downloadPath)
      info('[Sync] Download successful. Closing local database and applying cloud data...')

      broadcastSyncStatus({ status: 'syncing', message: 'Applying cloud changes...' })
      closeDatabase()
      await fs.copyFile(downloadPath, localDbPath)
      info('[Sync] Database file update complete. Reinitializing local database...')
      initDatabase()

      await fs.unlink(downloadPath).catch(() => {})
      await fs.unlink(tempBackupPath).catch(() => {})

      const newLocalChecksum = await getFileChecksum(localDbPath)
      info(`[Sync] Updated local checksum: ${newLocalChecksum}`)
      syncConfig.lastLocalChecksum = newLocalChecksum
      syncConfig.lastRemoteChecksum = cloudFile.md5Checksum
      syncConfig.lastCompletedAt = new Date().toISOString()
      await saveSyncConfig()

      syncStatus = 'idle'
      broadcastSyncStatus({ status: 'idle', message: 'Downloaded cloud changes.' })
      info('[Sync] Cloud database changes successfully applied locally.')

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
    info(
      `[Sync] Conflict detected. Both local database and Google Drive database have changed. Conflict policy is: ${syncConfig.conflictResolution || 'ask'}`
    )
    if (syncConfig.conflictResolution === 'prefer-local') {
      info(
        '[Sync] Applying conflict resolution policy: Prefer Local. Overwriting cloud database file...'
      )
      lastConflictStats = null
      const updated = await GoogleDriveService.updateDatabaseFile(
        accessToken,
        cloudFile.id,
        tempBackupPath
      )
      info(`[Sync] Conflict push successful. Updated Cloud MD5 Checksum: ${updated.md5Checksum}`)
      syncConfig.lastLocalChecksum = localChecksum
      syncConfig.lastRemoteChecksum = updated.md5Checksum
      syncConfig.lastCompletedAt = new Date().toISOString()
      await saveSyncConfig()
      await fs.unlink(tempBackupPath).catch(() => {})
      syncStatus = 'idle'
      broadcastSyncStatus({ status: 'idle', message: 'Conflict resolved: kept local.' })
      info('[Sync] Conflict resolved using local database version.')
      return { success: true, code: 'pushed', message: 'Conflict resolved: kept local.' }
    }

    if (syncConfig.conflictResolution === 'prefer-cloud') {
      info(
        '[Sync] Applying conflict resolution policy: Prefer Cloud. Downloading remote database to overwrite local...'
      )
      lastConflictStats = null
      const downloadPath = join(os.tmpdir(), `brickforge_download_${Date.now()}.db`)
      await GoogleDriveService.downloadDatabaseFile(accessToken, cloudFile.id, downloadPath)
      info('[Sync] Download successful. Closing local database and applying cloud data...')
      closeDatabase()
      await fs.copyFile(downloadPath, localDbPath)
      info('[Sync] Local database overwritten. Reinitializing database...')
      initDatabase()
      await fs.unlink(downloadPath).catch(() => {})
      await fs.unlink(tempBackupPath).catch(() => {})

      const newLocalChecksum = await getFileChecksum(localDbPath)
      info(`[Sync] Applied remote database checksum: ${newLocalChecksum}`)
      syncConfig.lastLocalChecksum = newLocalChecksum
      syncConfig.lastRemoteChecksum = cloudFile.md5Checksum
      syncConfig.lastCompletedAt = new Date().toISOString()
      await saveSyncConfig()

      syncStatus = 'idle'
      broadcastSyncStatus({ status: 'idle', message: 'Conflict resolved: kept cloud.' })
      info('[Sync] Conflict resolved using cloud database version.')

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
    info(
      '[Sync] Conflict policy is set to "ask". Downloading cloud database to compile comparison stats...'
    )
    const conflictDownloadPath = join(os.tmpdir(), `brickforge_conflict_${Date.now()}.db`)
    await GoogleDriveService.downloadDatabaseFile(accessToken, cloudFile.id, conflictDownloadPath)

    const remoteStats = getDatabaseStatsForFile(conflictDownloadPath)
    await fs.unlink(conflictDownloadPath).catch(() => {})
    const localStats = getDatabaseStatsForFile(localDbPath)
    await fs.unlink(tempBackupPath).catch(() => {})

    info(`[Sync] Conflict Comparison:
      Local:  Size=${localStats.fileSize}, CollectionSets=${localStats.userCollectionCount}, Sessions=${localStats.checkSessionsCount}, Notes=${localStats.setNotesCount}, Modified=${localStats.modifiedTime}
      Remote: Size=${remoteStats.fileSize}, CollectionSets=${remoteStats.userCollectionCount}, Sessions=${remoteStats.checkSessionsCount}, Notes=${remoteStats.setNotesCount}, Modified=${remoteStats.modifiedTime}`)

    lastConflictStats = { localStats, remoteStats }
    syncStatus = 'conflict'
    broadcastSyncStatus({ status: 'conflict', message: 'Conflict detected.' })
    info('[Sync] Conflict state set. Awaiting user resolution.')

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
