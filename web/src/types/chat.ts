export type ConversationSummary = {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  lastMessagePreview: string
  messageCount: number
}

export type Message = {
  id: string
  conversationId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: string
}

export type ConversationDetail = {
  id: string
  title: string
  userId: string
  createdAt: string
  updatedAt: string
  messages: Message[]
}

export type CreateConversationInput = {
  title?: string
  initialMessage?: string
}

export type CreateMessageInput = {
  content: string
}
