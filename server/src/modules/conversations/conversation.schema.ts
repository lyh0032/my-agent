import { z } from 'zod'

export const conversationParamsSchema = z.object({
  conversationId: z.string().trim().min(1)
})

export const createConversationBodySchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  initialMessage: z.string().trim().min(1).max(4000).optional()
})

export const updateConversationBodySchema = z.object({
  title: z.string().trim().min(1).max(120)
})

export const pinConversationBodySchema = z.object({
  isPinned: z.boolean()
})

export type CreateConversationBody = z.infer<typeof createConversationBodySchema>
export type UpdateConversationBody = z.infer<typeof updateConversationBodySchema>
export type PinConversationBody = z.infer<typeof pinConversationBodySchema>
