import { getDb } from '../database/connection'
import { CheckSession, CheckItem, ProgressSummary } from '../../shared/types/session'
import { CreateSessionSchema } from '../../shared/validation/sessionSchemas'

export function calculateItemStatus(
  expected: number,
  counted: number | null
): 'not_checked' | 'complete' | 'missing' | 'partial' | 'extra' {
  if (counted === null) return 'not_checked'
  if (counted === 0 && expected > 0) return 'missing'
  if (counted > 0 && counted < expected) return 'partial'
  if (counted === expected) return 'complete'
  return 'extra'
}

export function createSession(input: any): number {
  const parsed = CreateSessionSchema.parse(input)
  const db = getDb()

  // Find the set name and details
  const setDetails = db.prepare('SELECT name FROM sets WHERE set_num = ?').get(parsed.set_num) as
    | { name: string }
    | undefined
  if (!setDetails) {
    throw new Error(`Lego Set ${parsed.set_num} not found in database.`)
  }

  // Find the inventory ID
  const inventory = db
    .prepare('SELECT id FROM inventories WHERE set_num = ? ORDER BY version ASC LIMIT 1')
    .get(parsed.set_num) as { id: number } | undefined
  if (!inventory) {
    throw new Error(
      `Lego Set ${parsed.set_num} has no inventory data. Please import inventory files.`
    )
  }

  const now = new Date().toISOString()
  let sessionId = 0

  db.transaction(() => {
    // 1. Create check session
    const insertSession = db.prepare(`
      INSERT INTO check_sessions (set_num, name, include_spares, notes, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    const result = insertSession.run(
      parsed.set_num,
      parsed.name || `${parsed.set_num} - ${setDetails.name} - Inventory Check`,
      parsed.include_spares ? 1 : 0,
      parsed.notes,
      'in_progress',
      now,
      now
    )
    sessionId = result.lastInsertRowid as number

    // 2. Fetch inventory parts
    const partsSql = `
      SELECT part_num, color_id, quantity, is_spare, img_url
      FROM inventory_parts
      WHERE inventory_id = ?
      ${parsed.include_spares ? '' : 'AND is_spare = 0'}
    `
    const parts = db.prepare(partsSql).all(inventory.id) as {
      part_num: string
      color_id: number
      quantity: number
      is_spare: number
      img_url: string | null
    }[]

    // 3. Create check items
    const insertItem = db.prepare(`
      INSERT INTO check_items (session_id, part_num, color_id, expected_qty, counted_qty, is_spare, status, notes, source_img_url, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    for (const p of parts) {
      insertItem.run(
        sessionId,
        p.part_num,
        p.color_id,
        p.quantity,
        null, // counted_qty starts as null (not checked)
        p.is_spare,
        'not_checked',
        null,
        p.img_url,
        now,
        now
      )
    }
  })()

  return sessionId
}

export function getSession(
  sessionId: number
): { session: CheckSession; items: CheckItem[]; progress: ProgressSummary } | null {
  const db = getDb()

  const session = db
    .prepare(
      `
    SELECT cs.*, s.name as set_name, s.num_parts as total_parts
    FROM check_sessions cs
    JOIN sets s ON cs.set_num = s.set_num
    WHERE cs.id = ?
  `
    )
    .get(sessionId) as CheckSession | undefined

  if (!session) {
    return null
  }

  // Cast boolean from SQLite
  session.include_spares = Boolean(session.include_spares)

  // Fetch items with joined names, colors, categories and groups
  const items = db
    .prepare(
      `
    SELECT 
      ci.*, 
      p.name as part_name,
      c.name as color_name,
      c.rgb as color_rgb,
      c.is_transparent as color_transparent,
      pc.name as part_category_name,
      m.technic_group_id,
      tg.name as technic_group_name
    FROM check_items ci
    JOIN parts p ON ci.part_num = p.part_num
    JOIN colors c ON ci.color_id = c.id
    LEFT JOIN part_categories pc ON p.part_cat_id = pc.id
    LEFT JOIN part_technic_group_mapping m ON ci.part_num = m.part_num
    LEFT JOIN technic_groups tg ON m.technic_group_id = tg.id
    WHERE ci.session_id = ?
    ORDER BY tg.sort_order ASC, pc.name ASC, c.name ASC, p.name ASC, ci.part_num ASC
  `
    )
    .all(sessionId) as CheckItem[]

  // SQLite conversions
  for (const item of items) {
    item.is_spare = Boolean(item.is_spare)
    item.color_transparent = Boolean(item.color_transparent)
  }

  // Calculate session progress summary
  const progress = calculateProgress(items)

  return { session, items, progress }
}

export function updateCountedQty(itemId: number, countedQty: number | null): void {
  const db = getDb()
  const now = new Date().toISOString()

  // Get item to find current expected qty and session ID
  const item = db
    .prepare('SELECT expected_qty, session_id FROM check_items WHERE id = ?')
    .get(itemId) as
    | {
        expected_qty: number
        session_id: number
      }
    | undefined

  if (!item) {
    throw new Error(`Check Item with ID ${itemId} not found.`)
  }

  const status = calculateItemStatus(item.expected_qty, countedQty)

  db.transaction(() => {
    db.prepare(
      `
      UPDATE check_items
      SET counted_qty = ?, status = ?, updated_at = ?
      WHERE id = ?
    `
    ).run(countedQty, status, now, itemId)

    db.prepare(
      `
      UPDATE check_sessions
      SET updated_at = ?
      WHERE id = ?
    `
    ).run(now, item.session_id)
  })()
}

export function updateItemNotes(itemId: number, notes: string | null): void {
  const db = getDb()
  const now = new Date().toISOString()

  const item = db.prepare('SELECT session_id FROM check_items WHERE id = ?').get(itemId) as
    | { session_id: number }
    | undefined
  if (!item) return

  db.transaction(() => {
    db.prepare(
      `
      UPDATE check_items
      SET notes = ?, updated_at = ?
      WHERE id = ?
    `
    ).run(notes, now, itemId)

    db.prepare(
      `
      UPDATE check_sessions
      SET updated_at = ?
      WHERE id = ?
    `
    ).run(now, item.session_id)
  })()
}

export function updateSessionNotes(sessionId: number, notes: string | null): void {
  const db = getDb()
  const now = new Date().toISOString()

  db.prepare(
    `
    UPDATE check_sessions
    SET notes = ?, updated_at = ?
    WHERE id = ?
  `
  ).run(notes, now, sessionId)
}

export function updateSessionStatus(sessionId: number, status: string): void {
  const db = getDb()
  const now = new Date().toISOString()

  db.prepare(
    `
    UPDATE check_sessions
    SET status = ?, updated_at = ?
    WHERE id = ?
  `
  ).run(status, now, sessionId)
}

export function quickCompleteSession(sessionId: number): void {
  const db = getDb()
  const now = new Date().toISOString()

  db.transaction(() => {
    db.prepare(
      `
      UPDATE check_items
      SET counted_qty = expected_qty, status = 'complete', updated_at = ?
      WHERE session_id = ?
    `
    ).run(now, sessionId)

    db.prepare(
      `
      UPDATE check_sessions
      SET status = 'completed', updated_at = ?
      WHERE id = ?
    `
    ).run(now, sessionId)
  })()
}

export function duplicateSession(sessionId: number, newName: string): number {
  const db = getDb()
  const now = new Date().toISOString()

  const session = db.prepare('SELECT * FROM check_sessions WHERE id = ?').get(sessionId) as
    | CheckSession
    | undefined
  if (!session) {
    throw new Error(`Session ${sessionId} not found`)
  }

  let newSessionId = 0

  db.transaction(() => {
    // 1. Insert session
    const insertSession = db.prepare(`
      INSERT INTO check_sessions (set_num, name, include_spares, notes, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    const result = insertSession.run(
      session.set_num,
      newName,
      session.include_spares ? 1 : 0,
      session.notes,
      session.status,
      now,
      now
    )
    newSessionId = result.lastInsertRowid as number

    // 2. Fetch items
    const items = db
      .prepare('SELECT * FROM check_items WHERE session_id = ?')
      .all(sessionId) as any[]

    // 3. Insert items
    const insertItem = db.prepare(`
      INSERT INTO check_items (session_id, part_num, color_id, expected_qty, counted_qty, is_spare, status, notes, source_img_url, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    for (const item of items) {
      insertItem.run(
        newSessionId,
        item.part_num,
        item.color_id,
        item.expected_qty,
        item.counted_qty,
        item.is_spare,
        item.status,
        item.notes,
        item.source_img_url,
        now,
        now
      )
    }
  })()

  return newSessionId
}

export function deleteSession(sessionId: number): void {
  const db = getDb()
  db.prepare('DELETE FROM check_sessions WHERE id = ?').run(sessionId)
}

export function saveSetNotes(setNum: string, notes: string): void {
  const db = getDb()
  const now = new Date().toISOString()

  const existing = db.prepare('SELECT id FROM set_notes WHERE set_num = ? LIMIT 1').get(setNum) as
    | { id: number }
    | undefined

  if (existing) {
    db.prepare(
      `
      UPDATE set_notes
      SET notes = ?, updated_at = ?
      WHERE id = ?
    `
    ).run(notes, now, existing.id)
  } else {
    db.prepare(
      `
      INSERT INTO set_notes (set_num, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?)
    `
    ).run(setNum, notes, now, now)
  }
}

export function getCollectionOverview(): any[] {
  const db = getDb()

  // Get all sets that are in user_collection OR have at least one session
  const sets = db
    .prepare(
      `
    SELECT DISTINCT s.set_num, s.name, s.year, s.num_parts, s.image_url,
      uc.created_at as added_to_collection_at,
      uc.manual_complete,
      uc.manual_complete_at
    FROM sets s
    LEFT JOIN user_collection uc ON s.set_num = uc.set_num
    LEFT JOIN check_sessions cs ON s.set_num = cs.set_num
    WHERE uc.set_num IS NOT NULL OR cs.set_num IS NOT NULL
    ORDER BY s.year DESC, s.name ASC
  `
    )
    .all() as any[]

  const result: any[] = []

  for (const s of sets) {
    const isManuallyComplete = Boolean(s.manual_complete)

    // Get the latest session for this set
    const latestSession = db
      .prepare(
        `
      SELECT *
      FROM check_sessions
      WHERE set_num = ?
      ORDER BY updated_at DESC
      LIMIT 1
    `
      )
      .get(s.set_num) as any

    if (!latestSession) {
      result.push({
        set_num: s.set_num,
        name: s.name,
        year: s.year,
        image_url: s.image_url,
        expected_parts: s.num_parts,
        unique_rows: 0,
        session_id: null,
        session_name: null,
        session_status: isManuallyComplete ? 'manual_complete' : 'not_started',
        include_spares: false,
        completion_percentage: isManuallyComplete ? 100 : 0,
        row_completion_percentage: isManuallyComplete ? 100 : 0,
        missing_count: 0,
        missing_required_count: 0,
        missing_spares_count: 0,
        unchecked_count: isManuallyComplete ? 0 : s.num_parts,
        extra_count: 0,
        last_checked_date: s.manual_complete_at || s.added_to_collection_at || null,
        has_notes: false,
        manual_complete: isManuallyComplete,
        manual_complete_at: s.manual_complete_at || null
      })
      continue
    }

    latestSession.include_spares = Boolean(latestSession.include_spares)

    // Load session items to aggregate completeness stats
    const items = db
      .prepare(
        `
      SELECT expected_qty, counted_qty, is_spare, status
      FROM check_items
      WHERE session_id = ?
    `
      )
      .all(latestSession.id) as any[]

    const progress = calculateProgress(items)

    // Calculate details for required vs spare parts
    const requiredParts = items.filter((i) => !Boolean(i.is_spare))
    const spareParts = items.filter((i) => Boolean(i.is_spare))

    const missingRequiredCount = requiredParts.reduce((sum, item) => {
      const expected = item.expected_qty
      const counted = item.counted_qty === null ? 0 : item.counted_qty
      return sum + Math.max(0, expected - counted)
    }, 0)

    const missingSparesCount = spareParts.reduce((sum, item) => {
      const expected = item.expected_qty
      const counted = item.counted_qty === null ? 0 : item.counted_qty
      return sum + Math.max(0, expected - counted)
    }, 0)

    result.push({
      set_num: s.set_num,
      name: s.name,
      year: s.year,
      image_url: s.image_url,
      expected_parts: s.num_parts,
      unique_rows: items.length,
      session_id: latestSession.id,
      session_name: latestSession.name,
      session_status: isManuallyComplete ? 'manual_complete' : latestSession.status,
      include_spares: latestSession.include_spares,
      completion_percentage: isManuallyComplete ? 100 : progress.qtyCompletionPct,
      row_completion_percentage: isManuallyComplete ? 100 : progress.rowCompletionPct,
      missing_count: isManuallyComplete ? 0 : progress.totalMissingQty,
      missing_required_count: isManuallyComplete ? 0 : missingRequiredCount,
      missing_spares_count: isManuallyComplete ? 0 : missingSparesCount,
      unchecked_count: isManuallyComplete ? 0 : progress.uncheckedRows,
      extra_count: isManuallyComplete ? 0 : progress.totalExtraQty,
      last_checked_date: s.manual_complete_at || latestSession.updated_at,
      has_notes: Boolean(latestSession.notes),
      manual_complete: isManuallyComplete,
      manual_complete_at: s.manual_complete_at || null
    })
  }

  return result
}

export function addToCollection(setNum: string): void {
  const db = getDb()
  const now = new Date().toISOString()
  db.prepare(
    `
    INSERT OR IGNORE INTO user_collection (set_num, created_at)
    VALUES (?, ?)
  `
  ).run(setNum, now)
}

export function setCollectionManualComplete(setNum: string, complete: boolean): void {
  const db = getDb()
  const now = new Date().toISOString()

  db.prepare(
    `
    INSERT INTO user_collection (set_num, created_at, manual_complete, manual_complete_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(set_num) DO UPDATE SET
      manual_complete = excluded.manual_complete,
      manual_complete_at = excluded.manual_complete_at
  `
  ).run(setNum, now, complete ? 1 : 0, complete ? now : null)
}

export function removeFromCollection(setNum: string): void {
  const db = getDb()
  db.prepare(
    `
    DELETE FROM user_collection WHERE set_num = ?
  `
  ).run(setNum)
}

export function isSetInCollection(setNum: string): boolean {
  const db = getDb()
  const row = db
    .prepare(
      `
    SELECT 1 FROM user_collection WHERE set_num = ?
  `
    )
    .get(setNum)
  return !!row
}

export function getRecentSessions(): any[] {
  const db = getDb()
  const sessions = db
    .prepare(
      `
    SELECT cs.*, s.name as set_name, s.num_parts as total_parts, s.image_url as set_image
    FROM check_sessions cs
    JOIN sets s ON cs.set_num = s.set_num
    ORDER BY cs.updated_at DESC
    LIMIT 5
  `
    )
    .all() as any[]

  return sessions.map((s) => {
    // Get item counts
    const counts = db
      .prepare(
        `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN counted_qty IS NOT NULL THEN 1 ELSE 0 END) as checked,
        SUM(expected_qty) as total_qty,
        SUM(MIN(COALESCE(counted_qty, 0), expected_qty)) as counted_qty
      FROM check_items
      WHERE session_id = ?
    `
      )
      .get(s.id) as { total: number; checked: number; total_qty: number; counted_qty: number }

    const rowCompletionPct =
      counts.total > 0 ? Math.round((counts.checked / counts.total) * 100) : 0
    const qtyCompletionPct =
      counts.total_qty > 0
        ? Math.round((Math.min(counts.counted_qty, counts.total_qty) / counts.total_qty) * 100)
        : 0

    return {
      ...s,
      include_spares: Boolean(s.include_spares),
      unique_rows: counts.total,
      checked_rows: counts.checked,
      rowCompletionPct,
      qtyCompletionPct
    }
  })
}

export function getGeneralStats(): any {
  const db = getDb()

  const setsCount = db.prepare('SELECT count(*) as count FROM sets').get() as { count: number }
  const partsCount = db.prepare('SELECT count(*) as count FROM parts').get() as { count: number }
  const sessionsCount = db.prepare('SELECT count(*) as count FROM check_sessions').get() as {
    count: number
  }

  const collection = getCollectionOverview()
  const totalSets = collection.length
  const completeSets = collection.filter(
    (c) => c.completion_percentage === 100 && c.unchecked_count === 0
  ).length
  const incompleteSets = totalSets - completeSets
  const setsWithMissingParts = collection.filter((c) => c.missing_required_count > 0).length
  const sessionsInProgress = collection.filter((c) => c.session_status === 'in_progress').length

  const lastChecked = db
    .prepare(
      `
    SELECT cs.updated_at, s.name as set_name, cs.set_num
    FROM check_sessions cs
    JOIN sets s ON cs.set_num = s.set_num
    ORDER BY cs.updated_at DESC
    LIMIT 1
  `
    )
    .get() as { updated_at: string; set_name: string; set_num: string } | undefined

  return {
    catalogSetsCount: setsCount.count,
    catalogPartsCount: partsCount.count,
    sessionsCount: sessionsCount.count,
    totalSets,
    completeSets,
    incompleteSets,
    setsWithMissingParts,
    sessionsInProgress,
    lastCheckedSet: lastChecked ? `${lastChecked.set_num} - ${lastChecked.set_name}` : null
  }
}

export function updateExpectedQty(itemId: number, expectedQty: number): void {
  const db = getDb()
  const now = new Date().toISOString()

  // 1. Get current item details
  const item = db
    .prepare('SELECT session_id, part_num, color_id, is_spare, counted_qty FROM check_items WHERE id = ?')
    .get(itemId) as
    | {
        session_id: number
        part_num: string
        color_id: number
        is_spare: number
        counted_qty: number | null
      }
    | undefined

  if (!item) {
    throw new Error(`Check Item with ID ${itemId} not found.`)
  }

  // 2. Get session details to find set_num
  const session = db
    .prepare('SELECT set_num FROM check_sessions WHERE id = ?')
    .get(item.session_id) as { set_num: string } | undefined

  if (!session) {
    throw new Error(`Check Session with ID ${item.session_id} not found.`)
  }

  // 3. Find the inventory ID
  const inventory = db
    .prepare('SELECT id FROM inventories WHERE set_num = ? ORDER BY version ASC LIMIT 1')
    .get(session.set_num) as { id: number } | undefined

  const status = calculateItemStatus(expectedQty, item.counted_qty)

  db.transaction(() => {
    // 4. Update expected_qty and status in check_items
    db.prepare(
      `
      UPDATE check_items
      SET expected_qty = ?, status = ?, updated_at = ?
      WHERE id = ?
    `
    ).run(expectedQty, status, now, itemId)

    // 5. Update quantity in inventory_parts if inventory exists
    if (inventory) {
      db.prepare(
        `
        UPDATE inventory_parts
        SET quantity = ?
        WHERE inventory_id = ? AND part_num = ? AND color_id = ? AND is_spare = ?
      `
      ).run(expectedQty, inventory.id, item.part_num, item.color_id, item.is_spare)
    }

    // 6. Touch the session updated_at
    db.prepare(
      `
      UPDATE check_sessions
      SET updated_at = ?
      WHERE id = ?
    `
    ).run(now, item.session_id)
  })()
}

function calculateProgress(items: any[]): ProgressSummary {
  const totalRows = items.length
  let checkedRows = 0
  let totalExpectedQty = 0
  let totalCountedQty = 0
  let totalMissingQty = 0
  let totalExtraQty = 0
  let missingRowsCount = 0
  let extraRowsCount = 0

  for (const item of items) {
    const expected = item.expected_qty
    const counted = item.counted_qty

    totalExpectedQty += expected

    if (counted !== null) {
      checkedRows++
      totalCountedQty += Math.min(counted, expected)
      const diff = counted - expected

      if (diff < 0) {
        totalMissingQty += Math.abs(diff)
        missingRowsCount++
      } else if (diff > 0) {
        totalExtraQty += diff
        extraRowsCount++
      }
    } else {
      // Unchecked parts: assume counted is 0 for missing quantity calculations if required
      totalMissingQty += expected
    }
  }

  const uncheckedRows = totalRows - checkedRows
  const rowCompletionPct = totalRows > 0 ? Math.round((checkedRows / totalRows) * 100) : 0
  const qtyCompletionPct =
    totalExpectedQty > 0
      ? Math.round((Math.min(totalCountedQty, totalExpectedQty) / totalExpectedQty) * 100)
      : 0

  return {
    totalRows,
    checkedRows,
    uncheckedRows,
    totalExpectedQty,
    totalCountedQty,
    totalMissingQty,
    totalExtraQty,
    missingRowsCount,
    extraRowsCount,
    rowCompletionPct,
    qtyCompletionPct
  }
}
