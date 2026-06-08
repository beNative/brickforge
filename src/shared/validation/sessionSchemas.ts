import { z } from 'zod'

export const CreateSessionSchema = z.object({
  set_num: z.string().min(1, 'Set number is required'),
  name: z.string().min(1, 'Session name is required'),
  include_spares: z.boolean().default(false),
  notes: z.string().optional().nullable().transform(v => v || null)
})

export const UpdateCountedQtySchema = z.object({
  itemId: z.number(),
  countedQty: z.number().int().nonnegative().nullable()
})

export const UpdateItemNotesSchema = z.object({
  itemId: z.number(),
  notes: z.string().nullable()
})

export const UpdateSessionNotesSchema = z.object({
  sessionId: z.number(),
  notes: z.string().nullable()
})
