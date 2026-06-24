import fs from 'fs'
import Papa from 'papaparse'
import { getDb } from '../database/connection'
import { mapRebrickableToBrickLinkColor } from './colorMapping'

export interface ExportParams {
  sessionId: number
  filePath: string
  format: 'csv' | 'json' | 'xml'
  filter: 'all_missing' | 'non_spares_missing' | 'spares_missing'
}

export function exportMissingParts(params: ExportParams): void {
  const db = getDb()

  // 1. Get session details
  const session = db
    .prepare(
      `
    SELECT cs.name as session_name, cs.set_num, s.name as set_name
    FROM check_sessions cs
    JOIN sets s ON cs.set_num = s.set_num
    WHERE cs.id = ?
  `
    )
    .get(params.sessionId) as
    | { session_name: string; set_num: string; set_name: string }
    | undefined

  if (!session) {
    throw new Error(`Session ${params.sessionId} not found.`)
  }

  // 2. Fetch items with potential missing quantities
  // Missing means counted_qty < expected_qty (or counted_qty is null, which implies expected_qty is missing)
  const items = db
    .prepare(
      `
    SELECT 
      ci.part_num, 
      ci.color_id,
      p.name as part_name,
      c.name as color_name,
      ci.expected_qty,
      ci.counted_qty,
      ci.is_spare,
      ci.notes,
      ci.source_img_url as image_url
    FROM check_items ci
    JOIN parts p ON ci.part_num = p.part_num
    JOIN colors c ON ci.color_id = c.id
    WHERE ci.session_id = ?
  `
    )
    .all(params.sessionId) as any[]

  // 3. Filter missing items & apply spares filter
  const missingRows: any[] = []

  for (const item of items) {
    const expected = item.expected_qty
    const counted = item.counted_qty === null ? 0 : item.counted_qty
    const missingQty = expected - counted

    // If it's not missing, skip
    if (missingQty <= 0) continue

    const isSpare = Boolean(item.is_spare)

    // Apply filter
    if (params.filter === 'non_spares_missing' && isSpare) continue
    if (params.filter === 'spares_missing' && !isSpare) continue

    missingRows.push({
      'Set Number': session.set_num,
      'Set Name': session.set_name,
      'Session Name': session.session_name,
      'Part Number': item.part_num,
      'Part Name': item.part_name,
      'Color Name': item.color_name,
      'Color ID': item.color_id,
      'Expected Qty': expected,
      'Counted Qty': item.counted_qty === null ? '' : item.counted_qty,
      'Missing Qty': missingQty,
      'Is Spare': isSpare ? 'Yes' : 'No',
      'Image URL': item.image_url || '',
      Notes: item.notes || ''
    })
  }

  // 4. Serialize and write
  if (params.format === 'csv') {
    // Remove "Color ID" to keep standard format if needed, or leave it
    const csvRows = missingRows.map(({ 'Color ID': _, ...rest }) => rest)
    const csvContent = Papa.unparse(csvRows)
    fs.writeFileSync(params.filePath, csvContent, 'utf-8')
  } else if (params.format === 'json') {
    const jsonContent = JSON.stringify(missingRows, null, 2)
    fs.writeFileSync(params.filePath, jsonContent, 'utf-8')
  } else if (params.format === 'xml') {
    // Generate BrickLink Wanted List XML
    let xmlContent = '<INVENTORY>\n'
    for (const row of missingRows) {
      const blColorId = mapRebrickableToBrickLinkColor(row['Color ID'])
      xmlContent += '  <ITEM>\n'
      xmlContent += '    <ITEMTYPE>P</ITEMTYPE>\n'
      xmlContent += `    <ITEMID>${row['Part Number']}</ITEMID>\n`
      xmlContent += `    <COLOR>${blColorId}</COLOR>\n`
      xmlContent += `    <MINQTY>${row['Missing Qty']}</MINQTY>\n`
      xmlContent += '  </ITEM>\n'
    }
    xmlContent += '</INVENTORY>\n'
    fs.writeFileSync(params.filePath, xmlContent, 'utf-8')
  }
}
