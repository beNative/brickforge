export type SessionStatus = 'in_progress' | 'completed' | 'abandoned'

export type ItemStatus = 'not_checked' | 'complete' | 'missing' | 'partial' | 'extra'

export interface CheckSession {
  id: number
  set_num: string
  name: string
  include_spares: boolean
  notes: string | null
  status: SessionStatus
  created_at: string
  updated_at: string
  // UI fields added at runtime
  set_name?: string
  total_parts?: number
  completion_pct?: number
  missing_count?: number
  unchecked_count?: number
}

export interface CheckItem {
  id: number
  session_id: number
  part_num: string
  color_id: number
  expected_qty: number
  counted_qty: number | null
  is_spare: boolean
  status: ItemStatus
  notes: string | null
  source_img_url: string | null
  created_at: string
  updated_at: string
  // UI join fields
  part_name?: string
  color_name?: string
  color_rgb?: string | null
  color_transparent?: boolean
  part_category_name?: string
  technic_group_id?: number | null
  technic_group_name?: string
}

export interface SetNotes {
  id: number
  set_num: string
  notes: string
  created_at: string
  updated_at: string
}

export interface ProgressSummary {
  totalRows: number
  checkedRows: number
  uncheckedRows: number
  totalExpectedQty: number
  totalCountedQty: number
  totalMissingQty: number
  totalExtraQty: number
  missingRowsCount: number
  extraRowsCount: number
  rowCompletionPct: number
  qtyCompletionPct: number
}
