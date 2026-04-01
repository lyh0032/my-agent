import { z } from 'zod'

export const messageParamsSchema = z.object({
  conversationId: z.string().trim().min(1)
})

export const createMessageBodySchema = z.object({
  content: z.string().trim().min(1).max(4000)
})

export type CreateMessageBody = z.infer<typeof createMessageBodySchema>
