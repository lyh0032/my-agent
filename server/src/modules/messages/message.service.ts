import { prisma } from '../../lib/prisma'
import { generateAssistantReply, streamAssistantReply } from '../../lib/ai'
import { ensureConversationOwnership } from '../conversations/conversation.service'
import type { CreateMessageBody } from './message.schema'

type MessageGenerationContext = {
  history: Array<{
    id: string
    role: 'user' | 'assistant' | 'system'
    content: string
  }>
  memoryContext: string[]
}

async function loadMessageGenerationContext(userId: string, conversationId: string) {
  const [history, memories] = await Promise.all([
    prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' }
    }),
    prisma.memory.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: 20
    })
  ])

  return {
    history,
    memoryContext: memories.map((memory) => `【${memory.type}】${memory.key}: ${memory.content}`)
  } satisfies MessageGenerationContext
}

async function updateConversationMetadata(conversationId: string, firstUserInput?: string) {
  const messageCount = await prisma.message.count({
    where: { conversationId }
  })

  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      title: messageCount <= 2 && firstUserInput ? firstUserInput.slice(0, 40) : undefined,
      updatedAt: new Date()
    }
  })
}

export async function listMessages(userId: string, conversationId: string) {
  await ensureConversationOwnership(userId, conversationId)

  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' }
  })

  return { messages }
}

export async function createMessage(
  userId: string,
  conversationId: string,
  data: CreateMessageBody
) {
  await ensureConversationOwnership(userId, conversationId)

  const userMessage = await prisma.message.create({
    data: {
      conversationId,
      role: 'user',
      content: data.content
    }
  })

  const { history, memoryContext } = await loadMessageGenerationContext(userId, conversationId)

  const assistantContent = await generateAssistantReply({
    latestUserMessage: data.content,
    conversationHistory: history
      .filter((message) => message.id !== userMessage.id)
      .map((message) => ({
        role: message.role,
        content: message.content
      })),
    memoryContext
  })

  const assistantMessage = await prisma.message.create({
    data: {
      conversationId,
      role: 'assistant',
      content: assistantContent
    }
  })

  await updateConversationMetadata(conversationId, data.content)

  return {
    conversationId,
    userMessage,
    assistantMessage
  }
}

export async function streamMessage(
  userId: string,
  conversationId: string,
  data: CreateMessageBody,
  handlers: {
    onUserMessage: (payload: {
      id: string
      conversationId: string
      role: string
      content: string
      createdAt: Date
    }) => void
    onAssistantDelta: (delta: string) => void
    onAssistantStatus: (payload: { stage: 'thinking' | 'tool' | 'reasoning'; text: string }) => void
    onAssistantDone: (payload: {
      assistantMessage: {
        id: string
        conversationId: string
        role: string
        content: string
        createdAt: Date
      }
      conversationId: string
    }) => void
  }
) {
  await ensureConversationOwnership(userId, conversationId)

  const userMessage = await prisma.message.create({
    data: {
      conversationId,
      role: 'user',
      content: data.content
    }
  })

  handlers.onUserMessage(userMessage)

  const { history, memoryContext } = await loadMessageGenerationContext(userId, conversationId)

  let assistantContent = ''
  const stream = streamAssistantReply({
    latestUserMessage: data.content,
    conversationHistory: history
      .filter((message) => message.id !== userMessage.id)
      .map((message) => ({
        role: message.role,
        content: message.content
      })),
    memoryContext,
    onStatusChange(payload) {
      handlers.onAssistantStatus(payload)
    }
  })

  for await (const delta of stream) {
    assistantContent += delta
    handlers.onAssistantDelta(delta)
  }

  const assistantMessage = await prisma.message.create({
    data: {
      conversationId,
      role: 'assistant',
      content: assistantContent
    }
  })

  await updateConversationMetadata(conversationId, data.content)

  handlers.onAssistantDone({
    assistantMessage,
    conversationId
  })
}
