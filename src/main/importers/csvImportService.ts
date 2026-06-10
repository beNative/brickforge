import fs from 'fs'
import Papa from 'papaparse'
import { getDb } from '../database/connection'
import {
  ColorCsvSchema,
  PartCategoryCsvSchema,
  PartCsvSchema,
  SetCsvSchema,
  ThemeCsvSchema,
  InventoryCsvSchema,
  InventoryPartCsvSchema
} from '../../shared/validation/csvSchemas'
import { getTechnicGroupId } from '../../shared/constants/technicGroups'

export interface ImportResult {
  tableName: string
  successCount: number
  errorCount: number
  errors: string[]
}

export async function importCsvFile(
  filePath: string,
  type:
    | 'colors'
    | 'part_categories'
    | 'parts'
    | 'sets'
    | 'themes'
    | 'inventories'
    | 'inventory_parts',
  onProgress?: (progress: { current: number; totalEstimate?: number }) => void
): Promise<ImportResult> {
  const db = getDb()
  const errors: string[] = []
  let successCount = 0
  let errorCount = 0

  // 1. Prepare SQL Statements based on type
  let insertStmt: any
  let schema: any

  switch (type) {
    case 'colors':
      insertStmt = db.prepare(`
        INSERT INTO colors (id, name, rgb, is_transparent)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          rgb = excluded.rgb,
          is_transparent = excluded.is_transparent
      `)
      schema = ColorCsvSchema
      break
    case 'part_categories':
      insertStmt = db.prepare(`
        INSERT INTO part_categories (id, name)
        VALUES (?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name
      `)
      schema = PartCategoryCsvSchema
      break
    case 'parts':
      insertStmt = db.prepare(`
        INSERT INTO parts (part_num, name, part_cat_id, part_img_url)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(part_num) DO UPDATE SET
          name = excluded.name,
          part_cat_id = excluded.part_cat_id,
          part_img_url = COALESCE(excluded.part_img_url, part_img_url)
      `)
      schema = PartCsvSchema
      break
    case 'sets':
      insertStmt = db.prepare(`
        INSERT INTO sets (set_num, name, year, theme_id, num_parts, image_url)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(set_num) DO UPDATE SET
          name = excluded.name,
          year = excluded.year,
          theme_id = excluded.theme_id,
          num_parts = excluded.num_parts,
          image_url = COALESCE(excluded.image_url, image_url)
      `)
      schema = SetCsvSchema
      break
    case 'themes':
      insertStmt = db.prepare(`
        INSERT INTO themes (id, name, parent_id)
        VALUES (?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          parent_id = excluded.parent_id
      `)
      schema = ThemeCsvSchema
      break
    case 'inventories':
      insertStmt = db.prepare(`
        INSERT INTO inventories (id, version, set_num)
        VALUES (?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          version = excluded.version,
          set_num = excluded.set_num
      `)
      schema = InventoryCsvSchema
      break
    case 'inventory_parts':
      insertStmt = db.prepare(`
        INSERT INTO inventory_parts (inventory_id, part_num, color_id, quantity, is_spare, img_url)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(inventory_id, part_num, color_id, is_spare) DO UPDATE SET
          quantity = excluded.quantity,
          img_url = COALESCE(excluded.img_url, img_url)
      `)
      schema = InventoryPartCsvSchema
      break
    default:
      throw new Error(`Unknown import type: ${type}`)
  }

  // 2. Read and stream CSV
  const fileStream = fs.createReadStream(filePath, 'utf-8')

  // Estimate total size for progress (we can check file size and estimate based on bytes read)
  const stats = fs.statSync(filePath)
  const totalBytes = stats.size
  let bytesRead = 0

  return new Promise((resolve, reject) => {
    let batch: any[] = []
    const BATCH_SIZE = 1000

    const executeBatch = () => {
      if (batch.length === 0) return
      const transaction = db.transaction((rows) => {
        for (const row of rows) {
          try {
            // Apply parameters based on type
            if (type === 'colors') {
              insertStmt.run(row.id, row.name, row.rgb, row.is_trans ? 1 : 0)
            } else if (type === 'part_categories') {
              insertStmt.run(row.id, row.name)
            } else if (type === 'parts') {
              insertStmt.run(row.part_num, row.name, row.part_cat_id ?? null, null)
            } else if (type === 'sets') {
              insertStmt.run(
                row.set_num,
                row.name,
                row.year ?? null,
                row.theme_id ?? null,
                row.num_parts ?? null,
                row.img_url ?? null
              )
            } else if (type === 'themes') {
              insertStmt.run(row.id, row.name, row.parent_id ?? null)
            } else if (type === 'inventories') {
              insertStmt.run(row.id, row.version, row.set_num)
            } else if (type === 'inventory_parts') {
              insertStmt.run(
                row.inventory_id,
                row.part_num,
                row.color_id,
                row.quantity,
                row.is_spare ? 1 : 0,
                row.img_url ?? null
              )
            }
          } catch (e: any) {
            errorCount++
            if (errors.length < 50) {
              errors.push(`Row write error: ${e.message}`)
            }
          }
        }
      })
      transaction(batch)
      batch = []
    }

    Papa.parse(fileStream, {
      header: true,
      skipEmptyLines: true,
      chunk(results) {
        bytesRead = results.meta.cursor || 0

        for (const rawRow of results.data as any[]) {
          // Validate row
          const parsed = schema.safeParse(rawRow)
          if (parsed.success) {
            batch.push(parsed.data)
            successCount++

            if (batch.length >= BATCH_SIZE) {
              executeBatch()
            }
          } else {
            errorCount++
            if (errors.length < 50) {
              errors.push(
                `Validation error: ${parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`
              )
            }
          }
        }

        // Inform progress
        if (onProgress) {
          const progressPercent = Math.min(Math.round((bytesRead / totalBytes) * 100), 99)
          onProgress({ current: progressPercent })
        }
      },
      complete() {
        // Execute final batch
        try {
          executeBatch()
          if (onProgress) {
            onProgress({ current: 100 })
          }

          // Run post import mappings if we just imported parts or part categories
          if (type === 'parts' || type === 'part_categories') {
            runPostImportMappings()
          }

          resolve({
            tableName: type,
            successCount,
            errorCount,
            errors
          })
        } catch (e: any) {
          reject(e)
        }
      },
      error(err) {
        reject(err)
      }
    })
  })
}

/**
 * Runs a post-import mapping to populate part_technic_group_mapping.
 * Joins parts and part_categories, maps each part, and saves it.
 */
export function runPostImportMappings(): void {
  const db = getDb()
  console.log('Running post-import Technic Group mappings...')

  // Check if both tables have rows
  const partsCount = db.prepare('SELECT count(*) as count FROM parts').get() as { count: number }
  const catCount = db.prepare('SELECT count(*) as count FROM part_categories').get() as {
    count: number
  }

  if (partsCount.count === 0 || catCount.count === 0) {
    console.log('Skipping post-import mappings: parts or categories empty.')
    return
  }

  // Get parts that are not mapped yet
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
    .all() as { part_num: string; part_name: string; cat_name: string }[]

  if (unmappedParts.length === 0) {
    console.log('All parts already mapped to Technic Groups.')
    return
  }

  console.log(`Mapping ${unmappedParts.length} unmapped parts to Technic Groups...`)

  const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO part_technic_group_mapping (part_num, technic_group_id)
    VALUES (?, ?)
  `)

  db.transaction((partsToMap) => {
    for (const part of partsToMap) {
      const groupId = getTechnicGroupId(part.cat_name, part.part_name)
      insertStmt.run(part.part_num, groupId)
    }
  })(unmappedParts)

  console.log('Technic Group mappings complete.')
}
