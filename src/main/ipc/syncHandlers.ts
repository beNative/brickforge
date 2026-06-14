import { ipcMain, shell } from 'electron'
import {
  getSyncConfig,
  saveSyncConfig,
  runSyncInternal,
  startPeriodicSync,
  stopPeriodicSync,
  setOAuthServerCloseFn
} from '../services/syncService'
import { GoogleDriveService } from '../services/gdriveService'
import { info, error } from '../services/loggerService'

export function registerSyncHandlers(): void {
  ipcMain.handle('sync:get-config', () => {
    const config = getSyncConfig()
    return {
      syncEnabled: config.syncEnabled ?? false,
      clientId: config.clientId ?? '',
      clientSecret: config.clientSecret ?? '',
      email: config.email ?? null,
      refreshToken: config.refreshToken ?? null,
      syncAutoOnOpenClose: config.syncAutoOnOpenClose ?? false,
      conflictResolution: config.conflictResolution ?? 'ask',
      lastLocalChecksum: config.lastLocalChecksum ?? null,
      lastRemoteChecksum: config.lastRemoteChecksum ?? null,
      lastCompletedAt: config.lastCompletedAt ?? null,
      syncDatabaseName: config.syncDatabaseName ?? 'brickforge.db'
    }
  })

  ipcMain.handle('sync:save-config', async (_, config) => {
    const syncConfig = getSyncConfig()
    const wasEnabled = syncConfig.syncEnabled
    const oldDbName = syncConfig.syncDatabaseName || 'brickforge.db'
    const allowedKeys = [
      'syncEnabled',
      'clientId',
      'clientSecret',
      'syncAutoOnOpenClose',
      'conflictResolution',
      'syncDatabaseName'
    ]
    for (const key of allowedKeys) {
      if (key in config) {
        let val = config[key]
        if (typeof val === 'string') {
          val = val.trim()
        }
        ;(syncConfig as any)[key] = val
      }
    }

    const newDbName = syncConfig.syncDatabaseName || 'brickforge.db'
    if (newDbName !== oldDbName) {
      info(
        `[Sync] Target database changed from ${oldDbName} to ${newDbName}. Resetting tracking checksums.`
      )
      syncConfig.lastLocalChecksum = null
      syncConfig.lastRemoteChecksum = null
      syncConfig.lastCompletedAt = null
    }

    await saveSyncConfig()

    if (syncConfig.syncEnabled && !wasEnabled) {
      startPeriodicSync()
    } else if (!syncConfig.syncEnabled && wasEnabled) {
      stopPeriodicSync()
    }
    return { success: true }
  })

  ipcMain.handle('sync:list-remote-dbs', async () => {
    const config = getSyncConfig()
    if (!config.clientId || !config.clientSecret || !config.refreshToken) {
      return { success: false, error: 'Google Drive sync is not fully configured.' }
    }
    try {
      const refreshRes = await GoogleDriveService.refreshAccessToken(
        config.clientId,
        config.clientSecret,
        config.refreshToken
      )
      const files = await GoogleDriveService.listDatabaseFiles(refreshRes.accessToken)
      return {
        success: true,
        files: files.map((f) => ({
          name: f.name,
          id: f.id,
          modifiedTime: f.modifiedTime
        }))
      }
    } catch (err) {
      error('[Sync] Failed to list remote databases:', err)
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle('sync:google-connect', async (_, clientId, clientSecret) => {
    setOAuthServerCloseFn(null)

    const cleanClientId = typeof clientId === 'string' ? clientId.trim() : clientId
    const cleanClientSecret = typeof clientSecret === 'string' ? clientSecret.trim() : clientSecret

    return new Promise((resolve) => {
      const { authUrl, closeServer } = GoogleDriveService.startOAuthFlow(
        cleanClientId,
        cleanClientSecret,
        async (tokens) => {
          const config = getSyncConfig()
          config.syncEnabled = true
          config.clientId = cleanClientId
          config.clientSecret = cleanClientSecret
          config.refreshToken = tokens.refreshToken
          config.email = tokens.email
          await saveSyncConfig()

          startPeriodicSync()

          info(`[Sync] Account connected: ${tokens.email}`)
          resolve({ success: true, email: tokens.email })
          setOAuthServerCloseFn(null)
        },
        (err) => {
          error(`[Sync] Connection failed: ${err}`)
          resolve({ success: false, error: err })
          setOAuthServerCloseFn(null)
        }
      )

      setOAuthServerCloseFn(closeServer)
      shell.openExternal(authUrl)
    })
  })

  ipcMain.handle('sync:google-disconnect', async () => {
    setOAuthServerCloseFn(null)
    stopPeriodicSync()

    const config = getSyncConfig()
    config.syncEnabled = false
    config.refreshToken = undefined
    config.email = null
    config.lastLocalChecksum = null
    config.lastRemoteChecksum = null
    config.lastCompletedAt = null
    await saveSyncConfig()

    info('[Sync] Disconnected from Google Drive.')
    return { success: true }
  })

  ipcMain.handle('sync:run', async (_, options) => {
    return runSyncInternal(options)
  })

  ipcMain.handle('sync:resolve-conflict', async (_, resolution) => {
    if (resolution === 'local') {
      return runSyncInternal({ forcePush: true })
    } else {
      return runSyncInternal({ forcePull: true })
    }
  })

  ipcMain.handle('sync:get-status', async () => {
    const config = getSyncConfig()
    return {
      success: true,
      email: config.email ?? null,
      enabled: config.syncEnabled ?? false,
      lastCompletedAt: config.lastCompletedAt ?? null
    }
  })
}
