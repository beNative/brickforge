import { getDb } from '../database/connection'

export function searchParts(
  query: string,
  groupId: number | null,
  limit: number,
  offset: number
): { parts: any[]; totalCount: number } {
  const db = getDb()
  const q = `%${query}%`

  let sql = `
    SELECT p.part_num, p.name, p.part_cat_id, pc.name as part_category_name,
           (SELECT img_url FROM inventory_parts WHERE part_num = p.part_num AND img_url IS NOT NULL AND img_url != '' LIMIT 1) as part_img_url,
           m.technic_group_id, tg.name as technic_group_name
    FROM parts p
    LEFT JOIN part_categories pc ON p.part_cat_id = pc.id
    LEFT JOIN part_technic_group_mapping m ON p.part_num = m.part_num
    LEFT JOIN technic_groups tg ON m.technic_group_id = tg.id
    WHERE (p.part_num LIKE ? OR p.name LIKE ?)
  `
  let countSql = `
    SELECT COUNT(*) as count
    FROM parts p
    LEFT JOIN part_technic_group_mapping m ON p.part_num = m.part_num
    WHERE (p.part_num LIKE ? OR p.name LIKE ?)
  `
  const params: any[] = [q, q]

  if (groupId !== null) {
    sql += ' AND m.technic_group_id = ?'
    countSql += ' AND m.technic_group_id = ?'
    params.push(groupId)
  }

  // Execute total count query
  const countRes = db.prepare(countSql).get(...params) as { count: number }
  const totalCount = countRes ? countRes.count : 0

  // Execute paginated search query
  sql += ' ORDER BY p.name ASC, p.part_num ASC LIMIT ? OFFSET ?'
  const queryParams = [...params, limit, offset]
  const parts = db.prepare(sql).all(...queryParams) as any[]

  return { parts, totalCount }
}

export function getPartDetails(partNum: string): { part: any; crossReferences: any[] } | null {
  const db = getDb()

  const part = db
    .prepare(
      `
    SELECT p.part_num, p.name, p.part_cat_id, pc.name as part_category_name,
           (SELECT img_url FROM inventory_parts WHERE part_num = p.part_num AND img_url IS NOT NULL AND img_url != '' LIMIT 1) as part_img_url,
           m.technic_group_id, tg.name as technic_group_name
    FROM parts p
    LEFT JOIN part_categories pc ON p.part_cat_id = pc.id
    LEFT JOIN part_technic_group_mapping m ON p.part_num = m.part_num
    LEFT JOIN technic_groups tg ON m.technic_group_id = tg.id
    WHERE p.part_num = ?
  `
    )
    .get(partNum) as any

  if (!part) {
    return null
  }

  const crossReferences = db
    .prepare(
      `
    SELECT ip.inventory_id, ip.color_id, ip.quantity, ip.is_spare, ip.img_url,
           s.set_num, s.name as set_name, s.year as set_year, s.image_url as set_img_url,
           c.name as color_name, c.rgb as color_rgb
    FROM inventory_parts ip
    JOIN inventories i ON ip.inventory_id = i.id
    JOIN sets s ON i.set_num = s.set_num
    JOIN colors c ON ip.color_id = c.id
    WHERE ip.part_num = ?
    ORDER BY s.year DESC, s.name ASC, c.name ASC
  `
    )
    .all(partNum) as any[]

  // SQLite conversions
  for (const ref of crossReferences) {
    ref.is_spare = Boolean(ref.is_spare)
  }

  return { part, crossReferences }
}

export function getTechnicGroups(): any[] {
  const db = getDb()
  return db.prepare('SELECT id, name, sort_order FROM technic_groups ORDER BY sort_order ASC').all()
}
