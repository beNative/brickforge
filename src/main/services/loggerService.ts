import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, appendFileSync, writeFileSync } from 'fs'

export interface LogMessage {
  id: number
  timestamp: string
  level: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR'
  message: string
}

const logBuffer: LogMessage[] = []
const MAX_LOG_BUFFER = 1000
let idCounter = 1
let logsDir: string | null = null

function getLogsDir(): string {
  if (logsDir) return logsDir
  const userData = app.getPath('userData')
  logsDir = join(userData, 'logs')
  if (!existsSync(logsDir)) {
    mkdirSync(logsDir, { recursive: true })
  }
  return logsDir
}

function getLogFilePath(): string {
  const date = new Date()
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return join(getLogsDir(), `brickforge-${yyyy}-${mm}-${dd}.log`)
}

export function log(level: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR', message: string): void {
  const date = new Date()
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const mins = String(date.getMinutes()).padStart(2, '0')
  const secs = String(date.getSeconds()).padStart(2, '0')
  const ms = String(date.getMilliseconds()).padStart(3, '0')

  const timestamp = `${yyyy}-${mm}-${dd} ${hours}:${mins}:${secs}.${ms}`

  const logItem: LogMessage = {
    id: idCounter++,
    timestamp,
    level,
    message
  }

  // 1. Add to in-memory buffer
  logBuffer.push(logItem)
  if (logBuffer.length > MAX_LOG_BUFFER) {
    logBuffer.shift()
  }

  // 2. Append to log file
  try {
    const fileLine = `[${timestamp}] [${level}] ${message}\n`
    appendFileSync(getLogFilePath(), fileLine, 'utf8')
  } catch (err) {
    console.error('Failed to write log to file:', err)
  }

  // 3. Broadcast to all open renderer windows
  try {
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) {
        win.webContents.send('log-message', logItem)
      }
    })
  } catch (err) {
    // Ignore errors if windows are not ready or are being created
  }

  // Also print to console for development convenience
  if (level === 'ERROR') {
    console.error(`[${level}] ${message}`)
  } else if (level === 'WARNING') {
    console.warn(`[${level}] ${message}`)
  } else {
    console.log(`[${level}] ${message}`)
  }
}

export function debug(message: string): void {
  log('DEBUG', message)
}

export function info(message: string): void {
  log('INFO', message)
}

export function warn(message: string): void {
  log('WARNING', message)
}

export function error(message: string, err?: any): void {
  let msg = message
  if (err) {
    if (err.stack) {
      msg += `\n${err.stack}`
    } else {
      msg += ` - ${String(err)}`
    }
  }
  log('ERROR', msg)
}

export function getLogs(): LogMessage[] {
  return logBuffer
}

export function clearLogs(): void {
  logBuffer.length = 0
  try {
    const path = getLogFilePath()
    writeFileSync(path, `[${new Date().toISOString()}] [INFO] Log file cleared by user\n`, 'utf8')
  } catch (err) {
    console.error('Failed to clear log file:', err)
  }

  // Notify renderer windows to clear their state
  try {
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) {
        win.webContents.send('logs-cleared')
      }
    })
  } catch (err) {
    // Ignore
  }
}

export function openLogFolder(): void {
  try {
    const dir = getLogsDir()
    shell.openPath(dir)
  } catch (err) {
    console.error('Failed to open log folder:', err)
  }
}
