import { app } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'

export interface AppSettings {
  dbFolder: string
  dbName: string
}

let settings: AppSettings | null = null

function getSettingsPath(): string {
  const userData = app.getPath('userData')
  if (!existsSync(userData)) {
    mkdirSync(userData, { recursive: true })
  }
  return join(userData, 'settings.json')
}

export function loadSettings(): AppSettings {
  if (settings) return settings

  const path = getSettingsPath()
  if (existsSync(path)) {
    try {
      const data = JSON.parse(readFileSync(path, 'utf8'))
      settings = {
        dbFolder: data.dbFolder || app.getPath('userData'),
        dbName: data.dbName || 'brickforge.db'
      }
    } catch (e) {
      console.error('Failed to load settings, using defaults:', e)
    }
  }

  if (!settings) {
    settings = {
      dbFolder: app.getPath('userData'),
      dbName: 'brickforge.db'
    }
  }

  return settings
}

export function getSettings(): AppSettings {
  return loadSettings()
}

export function saveSettings(newSettings: AppSettings): void {
  settings = newSettings
  const path = getSettingsPath()
  const folder = settings.dbFolder
  if (!existsSync(folder)) {
    mkdirSync(folder, { recursive: true })
  }
  writeFileSync(path, JSON.stringify(settings, null, 2), 'utf8')
}
