const fs = require('fs')
const path = require('path')
const Database = require('better-sqlite3')
const Papa = require('papaparse')

// 1. Resolve DB Path
const appDataPath = process.env.APPDATA
if (!appDataPath) {
  console.error('ERROR: APPDATA environment variable not found.')
  process.exit(1)
}

const dbFolder = path.join(appDataPath, 'brickforge')
if (!fs.existsSync(dbFolder)) {
  fs.mkdirSync(dbFolder, { recursive: true })
}
const dbPath = path.join(dbFolder, 'brickforge.db')
console.log('Connecting to database at:', dbPath)

const db = new Database(dbPath)
db.pragma('foreign_keys = ON')

// Ensure Tables Exist (Run migrations)
db.transaction(() => {
  db.exec(`
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
  `)

  // Populate Technic Groups if empty
  const groupCount = db.prepare('SELECT count(*) as count FROM technic_groups').get()
  if (groupCount.count === 0) {
    const insertGroup = db.prepare(
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

// 2. Technic Group auto mapping rules (same as in app)
function getTechnicGroupId(categoryName, partName) {
  const cat = categoryName.toLowerCase()
  const name = partName.toLowerCase()

  if (cat.includes('sticker') || name.includes('sticker') || cat.includes('decal')) return 16
  if (cat.includes('pins') || cat.includes('pin ') || name.includes('technic pin')) return 1
  if (cat.includes('axles') || name.startsWith('technic axle') || name.includes('axle ')) return 2
  if (cat.includes('bush') || name.includes('bush ') || name.endsWith('bush')) return 3
  if (
    cat.includes('liftarm') ||
    name.includes('liftarm') ||
    cat.includes('beams') ||
    name.includes('technic beam')
  ) {
    if (name.includes('frame') || name.includes('rectangular') || name.includes(' H-shape'))
      return 6
    return 5
  }
  if (cat.includes('panels') || name.includes('panel')) return 7
  if (cat.includes('gears') || name.includes('gear ')) {
    if (name.includes('differential') || name.includes('diff ')) return 9
    return 8
  }
  if (name.includes('differential')) return 9
  if (
    cat.includes('steering') ||
    cat.includes('suspension') ||
    name.includes('steering') ||
    name.includes('suspension') ||
    name.includes('shock absorber') ||
    name.includes('wishbone') ||
    name.includes('portal axle')
  )
    return 10
  if (
    cat.includes('wheels') ||
    cat.includes('tyres') ||
    cat.includes('tires') ||
    name.includes('wheel ') ||
    name.includes('tyre ') ||
    name.includes('tire ') ||
    name.includes('sprocket') ||
    name.includes('track link')
  )
    return 11
  if (cat.includes('connectors') || name.includes('connector') || name.includes('cross block'))
    return 4
  if (
    cat.includes('pneumatic') ||
    name.includes('pneumatic') ||
    name.includes('pump') ||
    name.includes('cylinder')
  )
    return 12
  if (name.includes('linear actuator') || name.includes('actuator')) return 13
  if (
    cat.includes('electric') ||
    cat.includes('power functions') ||
    cat.includes('mindstorms') ||
    name.includes('motor') ||
    name.includes('battery') ||
    name.includes('led') ||
    name.includes('cable') ||
    name.includes('sensor') ||
    name.includes('receiver')
  )
    return 14
  if (
    cat.includes('hoses') ||
    cat.includes('strings') ||
    cat.includes('flexible') ||
    name.includes('hose') ||
    name.includes('string') ||
    name.includes('ribbon') ||
    name.includes('flex ')
  )
    return 15
  return 17
}

// 3. Importer function
function importCsv(filePath, type, parserSchema) {
  return new Promise((resolve, reject) => {
    console.log(`\nImporting ${type} from ${filePath}...`)

    let insertStmt
    switch (type) {
      case 'colors':
        insertStmt = db.prepare(`
          INSERT INTO colors (id, name, rgb, is_transparent) VALUES (?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            rgb = excluded.rgb,
            is_transparent = excluded.is_transparent
        `)
        break
      case 'part_categories':
        insertStmt = db.prepare(`
          INSERT INTO part_categories (id, name) VALUES (?, ?)
          ON CONFLICT(id) DO UPDATE SET
            name = excluded.name
        `)
        break
      case 'parts':
        insertStmt = db.prepare(`
          INSERT INTO parts (part_num, name, part_cat_id, part_img_url) VALUES (?, ?, ?, ?)
          ON CONFLICT(part_num) DO UPDATE SET
            name = excluded.name,
            part_cat_id = excluded.part_cat_id,
            part_img_url = COALESCE(excluded.part_img_url, part_img_url)
        `)
        break
      case 'sets':
        insertStmt = db.prepare(`
          INSERT INTO sets (set_num, name, year, theme_id, num_parts, image_url) VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(set_num) DO UPDATE SET
            name = excluded.name,
            year = excluded.year,
            theme_id = excluded.theme_id,
            num_parts = excluded.num_parts,
            image_url = COALESCE(excluded.image_url, image_url)
        `)
        break
      case 'themes':
        insertStmt = db.prepare(`
          INSERT INTO themes (id, name, parent_id) VALUES (?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            parent_id = excluded.parent_id
        `)
        break
      case 'inventories':
        insertStmt = db.prepare(`
          INSERT INTO inventories (id, version, set_num) VALUES (?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            version = excluded.version,
            set_num = excluded.set_num
        `)
        break
      case 'inventory_parts':
        insertStmt = db.prepare(`
          INSERT INTO inventory_parts (inventory_id, part_num, color_id, quantity, is_spare, img_url) VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(inventory_id, part_num, color_id, is_spare) DO UPDATE SET
            quantity = excluded.quantity,
            img_url = COALESCE(excluded.img_url, img_url)
        `)
        break
    }

    const fileStream = fs.createReadStream(filePath, 'utf-8')
    let successCount = 0
    let errorCount = 0
    let batch = []
    const BATCH_SIZE = 5000

    const executeBatch = () => {
      if (batch.length === 0) return
      db.transaction((rows) => {
        for (const row of rows) {
          try {
            if (type === 'colors') {
              insertStmt.run(
                parseInt(row.id, 10),
                row.name,
                row.rgb || 'FFFFFF',
                (row.is_trans || '').trim().toLowerCase() === 't' || (row.is_trans || '').trim().toLowerCase() === '1' || (row.is_trans || '').trim().toLowerCase() === 'true' ? 1 : 0
              )
            } else if (type === 'part_categories') {
              insertStmt.run(parseInt(row.id, 10), row.name)
            } else if (type === 'parts') {
              insertStmt.run(
                row.part_num,
                row.name,
                row.part_cat_id ? parseInt(row.part_cat_id, 10) : null,
                null
              )
            } else if (type === 'sets') {
              insertStmt.run(
                row.set_num,
                row.name,
                row.year ? parseInt(row.year, 10) : null,
                row.theme_id ? parseInt(row.theme_id, 10) : null,
                row.num_parts ? parseInt(row.num_parts, 10) : null,
                row.img_url || null
              )
            } else if (type === 'themes') {
              insertStmt.run(
                parseInt(row.id, 10),
                row.name,
                row.parent_id ? parseInt(row.parent_id, 10) : null
              )
            } else if (type === 'inventories') {
              insertStmt.run(
                parseInt(row.id, 10),
                row.version ? parseInt(row.version, 10) : 1,
                row.set_num
              )
            } else if (type === 'inventory_parts') {
              insertStmt.run(
                parseInt(row.inventory_id, 10),
                row.part_num,
                parseInt(row.color_id, 10),
                parseInt(row.quantity, 10),
                (row.is_spare || '').trim().toLowerCase() === 't' || (row.is_spare || '').trim().toLowerCase() === '1' || (row.is_spare || '').trim().toLowerCase() === 'true' ? 1 : 0,
                row.img_url || null
              )
            }
            successCount++
          } catch (e) {
            errorCount++
          }
        }
      })(batch)
      batch = []
    }

    Papa.parse(fileStream, {
      header: true,
      skipEmptyLines: true,
      chunk(results) {
        batch.push(...results.data)
        if (batch.length >= BATCH_SIZE) {
          executeBatch()
          process.stdout.write(`Imported ${successCount} rows...\r`)
        }
      },
      complete() {
        executeBatch()
        console.log(`Completed ${type} import. Success: ${successCount}, Errors: ${errorCount}`)
        resolve()
      },
      error(err) {
        console.error(`Error parsing CSV for ${type}`, err)
        reject(err)
      }
    })
  })
}

// 4. Run Post-Import Group mappings
function runPostImportMappings() {
  console.log('\nRunning post-import Technic Group mappings...')
  const partsCount = db.prepare('SELECT count(*) as count FROM parts').get()
  const catCount = db.prepare('SELECT count(*) as count FROM part_categories').get()

  if (partsCount.count === 0 || catCount.count === 0) {
    console.log('Skipping post mappings: parts or categories empty.')
    return
  }

  const unmappedParts = db
    .prepare(
      `
    SELECT p.part_num, p.name as part_name, pc.name as cat_name
    FROM parts p
    JOIN part_categories pc ON p.part_cat_id = pc.id
    LEFT JOIN part_technic_group_mapping m ON p.part_num = m.part_num
    WHERE m.part_num IS NULL
  `
    )
    .all()

  if (unmappedParts.length === 0) {
    console.log('All parts already mapped.')
    return
  }

  console.log(`Mapping ${unmappedParts.length} parts to Technic Groups...`)
  const insertStmt = db.prepare(
    'INSERT OR REPLACE INTO part_technic_group_mapping (part_num, technic_group_id) VALUES (?, ?)'
  )

  db.transaction((partsToMap) => {
    for (const part of partsToMap) {
      const groupId = getTechnicGroupId(part.cat_name, part.part_name)
      insertStmt.run(part.part_num, groupId)
    }
  })(unmappedParts)

  console.log('Technic Group mappings complete!')
}

// 5. Main execution sequence
async function run() {
  const csvDir = 'D:\\development\\nodejs\\brickforge\\csv'
  const filesToImport = [
    { file: 'colors.csv', type: 'colors' },
    { file: 'part_categories.csv', type: 'part_categories' },
    { file: 'parts.csv', type: 'parts' },
    { file: 'themes.csv', type: 'themes' },
    { file: 'sets.csv', type: 'sets' },
    { file: 'inventories.csv', type: 'inventories' },
    { file: 'inventory_parts.csv', type: 'inventory_parts' }
  ]

  try {
    for (const item of filesToImport) {
      const fullPath = path.join(csvDir, item.file)
      if (fs.existsSync(fullPath)) {
        await importCsv(fullPath, item.type)
      } else {
        console.warn(`WARNING: File not found at ${fullPath}. Skipping.`)
      }
    }

    runPostImportMappings()
    console.log('\nSUCCESS: All data imported successfully into BrickForge database!')
    db.close()
  } catch (err) {
    console.error('Import failed', err)
    db.close()
  }
}

run()
