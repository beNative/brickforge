import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'

let db: Database.Database

export function getDatabasePath(): string {
  const userDataPath = app.getPath('userData')
  if (!existsSync(userDataPath)) {
    mkdirSync(userDataPath, { recursive: true })
  }
  return join(userDataPath, 'brickforge.db')
}

export function initDatabase(): Database.Database {
  if (db) return db

  const dbPath = getDatabasePath()
  console.log('Initializing SQLite database at:', dbPath)
  
  db = new Database(dbPath)

  // Enable foreign keys
  db.pragma('foreign_keys = ON')

  // Run database migrations/schema setup
  runMigrations(db)

  return db
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
        FOREIGN KEY (set_num) REFERENCES sets(set_num) ON DELETE CASCADE
      );
    `)

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
    const groupCount = database.prepare('SELECT count(*) as count FROM technic_groups').get() as { count: number }
    if (groupCount.count === 0) {
      const insertGroup = database.prepare('INSERT OR IGNORE INTO technic_groups (id, name, sort_order) VALUES (?, ?, ?)')
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
