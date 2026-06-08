export interface LegoSet {
  set_num: string
  name: string
  year: number | null
  theme_id: number | null
  num_parts: number | null
  image_url: string | null
  // Extra UI helpers
  theme_name?: string
  has_sessions?: boolean
}

export interface LegoTheme {
  id: number
  name: string
  parent_id: number | null
}

export interface LegoPart {
  part_num: string
  name: string
  part_cat_id: number | null
  part_img_url: string | null
}

export interface LegoColor {
  id: number
  name: string
  rgb: string | null
  is_transparent: boolean
}

export interface LegoPartCategory {
  id: number
  name: string
}

export interface LegoInventory {
  id: number
  version: number
  set_num: string
}

export interface LegoInventoryPart {
  inventory_id: number
  part_num: string
  color_id: number
  quantity: number
  is_spare: boolean
  img_url: string | null
}
