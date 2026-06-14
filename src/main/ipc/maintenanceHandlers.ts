import { ipcMain, dialog, BrowserWindow, app } from 'electron'
import { getDatabasePath, closeDatabase, initDatabase, getDb } from '../database/connection'
import { getSettings } from '../services/settingsService'
import { execSync } from 'child_process'
import { join, dirname } from 'path'
import * as fs from 'fs'
import { info, warn, error } from '../services/loggerService'

export function registerMaintenanceHandlers(): void {
  // Backup database
  ipcMain.handle('database-backup', async (event) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (!win) return { success: false, error: 'Window not found' }

      const dbPath = getDatabasePath()
      if (!fs.existsSync(dbPath)) {
        return { success: false, error: 'Database file does not exist to backup.' }
      }

      const { filePath, canceled } = await dialog.showSaveDialog(win, {
        title: 'Backup Database to ZIP',
        defaultPath: `brickforge-backup-${new Date().toISOString().slice(0, 10)}.zip`,
        filters: [{ name: 'ZIP Archives', extensions: ['zip'] }]
      })

      if (canceled || !filePath) {
        return { success: false }
      }

      // Close database to release the file lock
      info(
        'Database backup started. Closing active SQLite database connection to release file lock...'
      )
      closeDatabase()

      const tempDir = join(app.getPath('temp'), `bf-backup-${Date.now()}`)
      fs.mkdirSync(tempDir, { recursive: true })

      try {
        const settings = getSettings()
        const targetTempFile = join(tempDir, settings.dbName)
        fs.copyFileSync(dbPath, targetTempFile)

        const escapedTempDir = tempDir.replace(/'/g, "''")
        const escapedDest = filePath.replace(/'/g, "''")

        // Compress via PowerShell
        info(`Compressing database into ZIP backup at destination: ${filePath}`)
        const cmd = `Compress-Archive -Path '${escapedTempDir}\\*' -DestinationPath '${escapedDest}' -Force`
        execSync(`powershell -NoProfile -NonInteractive -Command "${cmd}"`, { stdio: 'ignore' })

        info(`Successfully backed up database to ZIP: ${filePath}`)
      } finally {
        // Cleanup temp directory
        fs.rmSync(tempDir, { recursive: true, force: true })
        // Re-open/reconnect database
        initDatabase()
      }

      return { success: true }
    } catch (e: any) {
      error('Backup database failed:', e)
      return { success: false, error: e.message }
    }
  })

  // Restore database
  ipcMain.handle('database-restore', async (event) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (!win) return { success: false, error: 'Window not found' }

      const { filePaths, canceled } = await dialog.showOpenDialog(win, {
        title: 'Restore Database from ZIP',
        filters: [{ name: 'ZIP Archives', extensions: ['zip'] }],
        properties: ['openFile']
      })

      if (canceled || filePaths.length === 0) {
        return { success: false }
      }

      const zipPath = filePaths[0]
      const settings = getSettings()
      const dbPath = getDatabasePath()

      info(`Database restore started. Extracting ZIP: ${zipPath}`)
      // Create a temporary extraction directory
      const tempExtractDir = join(app.getPath('temp'), `bf-restore-${Date.now()}`)
      fs.mkdirSync(tempExtractDir, { recursive: true })

      try {
        const escapedZip = zipPath.replace(/'/g, "''")
        const escapedTempDir = tempExtractDir.replace(/'/g, "''")

        // Extract via PowerShell
        const cmd = `Expand-Archive -Path '${escapedZip}' -DestinationPath '${escapedTempDir}' -Force`
        execSync(`powershell -NoProfile -NonInteractive -Command "${cmd}"`, { stdio: 'ignore' })

        // Try to find the database file in the extracted directory
        let extractedDbFile = join(tempExtractDir, settings.dbName)
        if (!fs.existsSync(extractedDbFile)) {
          // Find any file ending in .db as fallback
          const files = fs.readdirSync(tempExtractDir)
          const dbFile = files.find((f) => f.endsWith('.db'))
          if (dbFile) {
            extractedDbFile = join(tempExtractDir, dbFile)
          } else {
            warn('Restore failed: Could not find database file in ZIP archive.')
            return {
              success: false,
              error: 'Could not find a valid database file (.db) in the ZIP archive.'
            }
          }
        }

        // Validate that the file is a valid SQLite database
        const headerBuffer = Buffer.alloc(16)
        const fd = fs.openSync(extractedDbFile, 'r')
        fs.readSync(fd, headerBuffer, 0, 16, 0)
        fs.closeSync(fd)

        if (headerBuffer.toString('utf8', 0, 15) !== 'SQLite format 3') {
          warn(
            'Restore failed: The extracted file is not a valid SQLite database (invalid header).'
          )
          return { success: false, error: 'The extracted file is not a valid SQLite database.' }
        }

        // Close the current database connection to free up resources/locks
        info('Valid database file found. Closing active SQLite database connection...')
        closeDatabase()

        // Create a safety fallback copy of the active database
        const backupPath = dbPath + '.bak'
        if (fs.existsSync(dbPath)) {
          fs.copyFileSync(dbPath, backupPath)
        }

        try {
          const dbDir = dirname(dbPath)
          if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true })
          }
          // Overwrite active database file
          info(`Overwriting active database at: ${dbPath}`)
          fs.copyFileSync(extractedDbFile, dbPath)

          // Delete fallback copy on success
          if (fs.existsSync(backupPath)) {
            fs.rmSync(backupPath, { force: true })
          }
          info(`Successfully restored database from: ${zipPath}`)
        } catch (copyErr) {
          // Revert active database from backup if copy failed
          warn('Restore write failed. Reverting active database from fallback copy...')
          if (fs.existsSync(backupPath)) {
            fs.copyFileSync(backupPath, dbPath)
            fs.rmSync(backupPath, { force: true })
          }
          throw copyErr
        }
      } finally {
        // Clean up extracted files
        fs.rmSync(tempExtractDir, { recursive: true, force: true })
        // Re-initialize database connection
        initDatabase()
      }

      return { success: true }
    } catch (e: any) {
      error('Restore database failed:', e)
      return { success: false, error: e.message }
    }
  })

  // Vacuum database
  ipcMain.handle('database-vacuum', async () => {
    try {
      const db = getDb()
      info('Optimizing database via VACUUM...')
      db.exec('VACUUM')
      info('Database VACUUM completed successfully.')
      return { success: true }
    } catch (e: any) {
      error('Database VACUUM failed:', e)
      return { success: false, error: e.message }
    }
  })

  // Reindex database
  ipcMain.handle('database-reindex', async () => {
    try {
      const db = getDb()
      info('Rebuilding database indexes via REINDEX...')
      db.exec('REINDEX')
      info('Database REINDEX completed successfully.')
      return { success: true }
    } catch (e: any) {
      error('Database REINDEX failed:', e)
      return { success: false, error: e.message }
    }
  })
}
