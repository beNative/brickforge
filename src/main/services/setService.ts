import { getDb } from '../database/connection'
import { LegoSet } from '../../shared/types/lego'

export interface SetSearchResult extends LegoSet {
  has_sessions: boolean
}

export function searchSets(query: string): SetSearchResult[] {
  const db = getDb()
  const trimmed = query.trim()

  if (!trimmed) {
    return []
  }

  // Check if query is a year
  const queryAsNum = parseInt(trimmed, 10)
  const isYear = !isNaN(queryAsNum) && queryAsNum > 1900 && queryAsNum < 2100

  const sql = `
    SELECT 
      s.set_num, 
      s.name, 
      s.year, 
      s.theme_id, 
      s.num_parts, 
      s.image_url,
      t.name as theme_name,
      EXISTS (
        SELECT 1 FROM check_sessions cs WHERE cs.set_num = s.set_num
      ) as has_sessions
    FROM sets s
    LEFT JOIN themes t ON s.theme_id = t.id
    WHERE 
      s.set_num LIKE ? 
      OR s.name LIKE ?
      ${isYear ? 'OR s.year = ?' : ''}
    ORDER BY s.year DESC, s.set_num ASC
    LIMIT 100
  `

  const searchPattern = `%${trimmed}%`
  const params: any[] = [searchPattern, searchPattern]
  if (isYear) {
    params.push(queryAsNum)
  }

  const results = db.prepare(sql).all(...params) as SetSearchResult[]
  // SQLite returns integers for boolean flags
  return results.map((r) => ({
    ...r,
    has_sessions: Boolean(r.has_sessions)
  }))
}

export function getSetDetails(setNum: string) {
  const db = getDb()

  const setInfo = db
    .prepare(
      `
    SELECT 
      s.set_num, 
      s.name, 
      s.year, 
      s.theme_id, 
      s.num_parts, 
      s.image_url,
      t.name as theme_name
    FROM sets s
    LEFT JOIN themes t ON s.theme_id = t.id
    WHERE s.set_num = ?
  `
    )
    .get(setNum) as LegoSet | undefined

  if (!setInfo) {
    return null
  }

  const sessions = db
    .prepare(
      `
    SELECT id, name, status, include_spares, created_at, updated_at
    FROM check_sessions
    WHERE set_num = ?
    ORDER BY updated_at DESC
  `
    )
    .all(setNum)

  const notes = db
    .prepare(
      `
    SELECT notes
    FROM set_notes
    WHERE set_num = ?
    ORDER BY updated_at DESC
    LIMIT 1
  `
    )
    .get(setNum) as { notes: string } | undefined

  // Find inventory ID
  const inventory = db
    .prepare(
      `
    SELECT id FROM inventories WHERE set_num = ? ORDER BY version ASC LIMIT 1
  `
    )
    .get(setNum) as { id: number } | undefined

  let uniquePartsCount = 0
  if (inventory) {
    const partsCount = db
      .prepare(
        `
      SELECT count(*) as count FROM inventory_parts WHERE inventory_id = ?
    `
      )
      .get(inventory.id) as { count: number }
    uniquePartsCount = partsCount.count
  }

  return {
    ...setInfo,
    uniquePartsCount,
    sessions,
    notes: notes?.notes || null
  }
}

export function getSetParts(setNum: string): any[] {
  const db = getDb()
  const inventory = db
    .prepare(
      `
    SELECT id FROM inventories WHERE set_num = ? ORDER BY version ASC LIMIT 1
  `
    )
    .get(setNum) as { id: number } | undefined

  if (!inventory) {
    return []
  }

  const parts = db
    .prepare(
      `
    SELECT 
      ip.part_num, 
      ip.color_id, 
      ip.quantity, 
      ip.is_spare, 
      ip.img_url,
      p.name as part_name,
      c.name as color_name,
      c.rgb as color_rgb,
      c.is_transparent as color_transparent,
      pc.name as part_category_name,
      m.technic_group_id,
      tg.name as technic_group_name
    FROM inventory_parts ip
    JOIN parts p ON ip.part_num = p.part_num
    JOIN colors c ON ip.color_id = c.id
    LEFT JOIN part_categories pc ON p.part_cat_id = pc.id
    LEFT JOIN part_technic_group_mapping m ON ip.part_num = m.part_num
    LEFT JOIN technic_groups tg ON m.technic_group_id = tg.id
    WHERE ip.inventory_id = ?
    ORDER BY tg.sort_order ASC, pc.name ASC, c.name ASC, p.name ASC, ip.part_num ASC
  `
    )
    .all(inventory.id) as any[]

  return parts.map((p) => ({
    ...p,
    is_spare: Boolean(p.is_spare),
    color_transparent: Boolean(p.color_transparent)
  }))
}
