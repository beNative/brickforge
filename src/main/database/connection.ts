import Database from 'better-sqlite3'
import { join, dirname } from 'path'
import { existsSync, mkdirSync, statSync } from 'fs'
import { getSettings } from '../services/settingsService'
import { info, error } from '../services/loggerService'

let db: Database.Database

export function getDatabasePath(): string {
  const settings = getSettings()
  return join(settings.dbFolder, settings.dbName)
}

export function initDatabase(): Database.Database {
  if (db) return db

  const dbPath = getDatabasePath()
  const dbDir = dirname(dbPath)
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true })
  }
  info(`Initializing SQLite database at: ${dbPath}`)

  db = new Database(dbPath)

  // Enable foreign keys
  db.pragma('foreign_keys = ON')

  // Run database migrations/schema setup
  info('Running database migrations/schema checks...')
  runMigrations(db)

  return db
}

export function closeDatabase(): void {
  if (db) {
    info('Closing active SQLite database connection...')
    try {
      db.close()
    } catch (e) {
      error('Error closing database:', e)
    }
    db = undefined as any
  }
}

export function reconnectDatabase(): Database.Database {
  info('Triggering database reconnection flow...')
  closeDatabase()
  const newDb = initDatabase()
  info('Database reconnection completed successfully.')
  return newDb
}

export function getDb(): Database.Database {
  if (!db) {
    return initDatabase()
  }
  return db
}

function runMigrations(database: Database.Database): void {
  database.transaction(() => {
    // Create Tables
    database.exec(`
      CREATE TABLE IF NOT EXISTS sets (
        set_num TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        year INTEGER,
        theme_id INTEGER,
        num_parts INTEGER,
        image_url TEXT
      );

      CREATE TABLE IF NOT EXISTS themes (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        parent_id INTEGER
      );

      CREATE TABLE IF NOT EXISTS parts (
        part_num TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        part_cat_id INTEGER,
        part_img_url TEXT
      );

      CREATE TABLE IF NOT EXISTS colors (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        rgb TEXT,
        is_transparent BOOLEAN
      );

      CREATE TABLE IF NOT EXISTS part_categories (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS inventories (
        id INTEGER PRIMARY KEY,
        version INTEGER,
        set_num TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS inventory_parts (
        inventory_id INTEGER NOT NULL,
        part_num TEXT NOT NULL,
        color_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        is_spare BOOLEAN NOT NULL DEFAULT 0,
        img_url TEXT,
        PRIMARY KEY (inventory_id, part_num, color_id, is_spare)
      );

      CREATE TABLE IF NOT EXISTS technic_groups (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        sort_order INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS part_technic_group_mapping (
        part_num TEXT PRIMARY KEY,
        technic_group_id INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS check_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        set_num TEXT NOT NULL,
        name TEXT NOT NULL,
        include_spares BOOLEAN NOT NULL DEFAULT 0,
        notes TEXT,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS check_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL,
        part_num TEXT NOT NULL,
        color_id INTEGER NOT NULL,
        expected_qty INTEGER NOT NULL,
        counted_qty INTEGER,
        is_spare BOOLEAN NOT NULL DEFAULT 0,
        status TEXT NOT NULL,
        notes TEXT,
        source_img_url TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (session_id) REFERENCES check_sessions(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS set_notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        set_num TEXT NOT NULL,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS user_collection (
        set_num TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        manual_complete BOOLEAN NOT NULL DEFAULT 0,
        manual_complete_at TEXT,
        FOREIGN KEY (set_num) REFERENCES sets(set_num) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS image_cache (
        url TEXT PRIMARY KEY,
        image_data BLOB NOT NULL,
        content_type TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        cached_at TEXT NOT NULL
      );
    `)

    // Deduplicate set_notes by keeping only the latest note per set_num
    database.exec(`
      DELETE FROM set_notes
      WHERE id NOT IN (
        SELECT MAX(id)
        FROM set_notes
        GROUP BY set_num
      );
    `)

    const collectionColumns = database.prepare('PRAGMA table_info(user_collection)').all() as {
      name: string
    }[]
    const hasManualComplete = collectionColumns.some((column) => column.name === 'manual_complete')
    const hasManualCompleteAt = collectionColumns.some(
      (column) => column.name === 'manual_complete_at'
    )

    if (!hasManualComplete) {
      database.exec(
        'ALTER TABLE user_collection ADD COLUMN manual_complete BOOLEAN NOT NULL DEFAULT 0'
      )
    }

    if (!hasManualCompleteAt) {
      database.exec('ALTER TABLE user_collection ADD COLUMN manual_complete_at TEXT')
    }

    // Create Indexes
    database.exec(`
      CREATE INDEX IF NOT EXISTS idx_sets_name ON sets(name);
      CREATE INDEX IF NOT EXISTS idx_sets_year ON sets(year);
      CREATE INDEX IF NOT EXISTS idx_parts_name ON parts(name);
      CREATE INDEX IF NOT EXISTS idx_inventory_parts_inventory_id ON inventory_parts(inventory_id);
      CREATE INDEX IF NOT EXISTS idx_inventory_parts_part_num ON inventory_parts(part_num);
      CREATE INDEX IF NOT EXISTS idx_check_items_session_id ON check_items(session_id);
      CREATE INDEX IF NOT EXISTS idx_check_items_status ON check_items(status);
      CREATE INDEX IF NOT EXISTS idx_check_sessions_set_num ON check_sessions(set_num);
    `)

    // Populate Technic Groups if empty
    const groupCount = database.prepare('SELECT count(*) as count FROM technic_groups').get() as {
      count: number
    }
    if (groupCount.count === 0) {
      const insertGroup = database.prepare(
        'INSERT OR IGNORE INTO technic_groups (id, name, sort_order) VALUES (?, ?, ?)'
      )
      const groups = [
        [1, 'Pins', 1],
        [2, 'Axles', 2],
        [3, 'Bushes', 3],
        [4, 'Connectors', 4],
        [5, 'Liftarms', 5],
        [6, 'Frames', 6],
        [7, 'Panels', 7],
        [8, 'Gears', 8],
        [9, 'Differentials', 9],
        [10, 'Steering and suspension parts', 10],
        [11, 'Wheels and tyres', 11],
        [12, 'Pneumatics', 12],
        [13, 'Linear actuators', 13],
        [14, 'Electronics', 14],
        [15, 'Hoses, strings and flex parts', 15],
        [16, 'Stickers', 16],
        [17, 'Other', 17]
      ]
      for (const g of groups) {
        insertGroup.run(g[0], g[1], g[2])
      }
    }
  })()
}

export async function backupDatabase(filePath: string): Promise<void> {
  const activeDb = getDb()
  await activeDb.backup(filePath)
}

export function getDatabaseStatsForFile(filePath: string) {
  if (!existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`)
  }
  const fileSize = statSync(filePath).size
  let connection: Database.Database | null = null
  try {
    connection = new Database(filePath, { readonly: true })
    
    // Check if tables exist before querying, to prevent errors on arbitrary db files
    const userColExists = connection.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='user_collection'").get()
    const checkSessionsExists = connection.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='check_sessions'").get()
    const setNotesExists = connection.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='set_notes'").get()

    let userCollectionCount = 0
    let checkSessionsCount = 0
    let setNotesCount = 0

    if (userColExists) {
      const row = connection.prepare("SELECT COUNT(*) as count FROM user_collection").get() as { count: number }
      userCollectionCount = row?.count ?? 0
    }
    if (checkSessionsExists) {
      const row = connection.prepare("SELECT COUNT(*) as count FROM check_sessions").get() as { count: number }
      checkSessionsCount = row?.count ?? 0
    }
    if (setNotesExists) {
      const row = connection.prepare("SELECT COUNT(*) as count FROM set_notes").get() as { count: number }
      setNotesCount = row?.count ?? 0
    }

    const modifiedTime = statSync(filePath).mtime.toISOString()

    return {
      fileSize: `${(fileSize / 1024).toFixed(2)} KB`,
      userCollectionCount,
      checkSessionsCount,
      setNotesCount,
      modifiedTime
    }
  } catch (e: any) {
    error(`Failed to get stats for database file ${filePath}:`, e)
    throw e
  } finally {
    if (connection) {
      connection.close()
    }
  }
}

