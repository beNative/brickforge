import { z } from 'zod'

export const ColorCsvSchema = z.object({
  id: z.coerce.number(),
  name: z.string().min(1),
  rgb: z
    .string()
    .optional()
    .nullable()
    .transform((val) => val || 'FFFFFF'),
  is_trans: z.string().transform((val) => {
    const clean = val.trim().toLowerCase()
    return clean === 't' || clean === '1' || clean === 'true'
  })
})

export const PartCategoryCsvSchema = z.object({
  id: z.coerce.number(),
  name: z.string().min(1)
})

export const PartCsvSchema = z.object({
  part_num: z.string().min(1),
  name: z.string().min(1),
  part_cat_id: z.coerce.number().optional().nullable()
})

export const SetCsvSchema = z.object({
  set_num: z.string().min(1),
  name: z.string().min(1),
  year: z.coerce.number().optional().nullable(),
  theme_id: z.coerce.number().optional().nullable(),
  num_parts: z.coerce.number().optional().nullable(),
  img_url: z.string().optional().nullable()
})

export const ThemeCsvSchema = z.object({
  id: z.coerce.number(),
  name: z.string().min(1),
  parent_id: z.coerce.number().optional().nullable()
})

export const InventoryCsvSchema = z.object({
  id: z.coerce.number(),
  version: z.coerce
    .number()
    .optional()
    .nullable()
    .transform((val) => val || 1),
  set_num: z.string().min(1)
})

export const InventoryPartCsvSchema = z.object({
  inventory_id: z.coerce.number(),
  part_num: z.string().min(1),
  color_id: z.coerce.number(),
  quantity: z.coerce.number(),
  is_spare: z.string().transform((val) => {
    const clean = val.trim().toLowerCase()
    return clean === 't' || clean === '1' || clean === 'true'
  }),
  img_url: z.string().optional().nullable()
})
