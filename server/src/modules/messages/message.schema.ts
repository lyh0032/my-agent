import { z } from 'zod'

export const messageParamsSchema = z.object({
  conversationId: z.string().trim().min(1)
})

export const messageStreamParamsSchema = z.object({
  conversationId: z.string().trim().min(1),
  messageId: z.string().trim().min(1)
})

export const createMessageBodySchema = z.object({
  content: z.string().trim().min(1).max(4000)
})

export const updateMessageBodySchema = z.object({
  content: z.string().trim().min(1).max(4000)
})

export const updateMessageParamsSchema = z.object({
  conversationId: z.string().trim().min(1),
  messageId: z.string().trim().min(1)
})

export const deleteMessageParamsSchema = z.object({
  conversationId: z.string().trim().min(1),
  messageId: z.string().trim().min(1)
})

export const regenerateMessageParamsSchema = z.object({
  conversationId: z.string().trim().min(1),
  messageId: z.string().trim().min(1)
})

export type CreateMessageBody = z.infer<typeof createMessageBodySchema>
export type UpdateMessageBody = z.infer<typeof updateMessageBodySchema>
export type MessageStreamParams = z.infer<typeof messageStreamParamsSchema>
export type UpdateMessageParams = z.infer<typeof updateMessageParamsSchema>
export type DeleteMessageParams = z.infer<typeof deleteMessageParamsSchema>
export type RegenerateMessageParams = z.infer<typeof regenerateMessageParamsSchema>
