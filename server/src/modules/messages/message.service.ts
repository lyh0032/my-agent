import { prisma } from '../../lib/prisma'
import {
  generateAssistantReply,
  generateConversationTitle,
  generateMemoryCandidates,
  streamAssistantReply
} from '../../lib/ai'
import {
  ensureConversationOwnership,
  updateConversation
} from '../conversations/conversation.service'
import { upsertAutoMemories } from '../memories/memory.service'
import { getModelNameForLLM } from '../model-preferences/model-preference.service'
import type { CreateMessageBody } from './message.schema'

type MessageGenerationContext = {
  history: Array<{
    id: string
    role: 'user' | 'assistant' | 'system'
    content: string
  }>
  memories: Array<{
    type: 'profile' | 'preference' | 'summary' | 'fact'
    key: string
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
    memories: memories.map((memory) => ({
      type: memory.type,
      key: memory.key,
      content: memory.content
    })),
    memoryContext: memories.map((memory) => `【${memory.type}】${memory.key}: ${memory.content}`)
  } satisfies MessageGenerationContext
}

async function updateConversationMetadata(
  userId: string,
  conversationId: string,
  options?: {
    firstUserInput?: string
    shouldGenerateTitle?: boolean
    modelOverride?: string
  }
) {
  if (options?.shouldGenerateTitle && options.firstUserInput?.trim()) {
    const generatedTitle = await generateConversationTitle({
      userMessage: options.firstUserInput,
      modelOverride: options.modelOverride
    })

    await updateConversation(userId, conversationId, {
      title: generatedTitle
    })

    return
  }

  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      updatedAt: new Date()
    }
  })
}

function scheduleConversationMetadataUpdate(
  userId: string,
  conversationId: string,
  options?: {
    firstUserInput?: string
    shouldGenerateTitle?: boolean
    modelOverride?: string
  }
) {
  return updateConversationMetadata(userId, conversationId, options).catch((error) => {
    console.error('Failed to update conversation metadata:', error)
  })
}

function scheduleUserMemoryExtraction(
  userId: string,
  payload: {
    userMessage: string
    existingMemories: MessageGenerationContext['memories']
    modelOverride?: string
  }
) {
  void (async () => {
    const extractedMemories = await generateMemoryCandidates({
      userMessage: payload.userMessage,
      existingMemories: payload.existingMemories,
      modelOverride: payload.modelOverride
    })

    if (extractedMemories.length === 0) {
      return
    }

    const result = await upsertAutoMemories(userId, extractedMemories)
    console.log('Auto memories synced:', result)
  })().catch((error) => {
    console.error('Failed to extract user memories:', error)
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

  const existingMessageCount = await prisma.message.count({
    where: { conversationId }
  })
  const shouldGenerateTitle = existingMessageCount === 0

  const userMessage = await prisma.message.create({
    data: {
      conversationId,
      role: 'user',
      content: data.content
    }
  })

  const { history, memories, memoryContext } = await loadMessageGenerationContext(
    userId,
    conversationId
  )
  const preferredModel = await getModelNameForLLM(userId)
  const conversationMetadataTask = scheduleConversationMetadataUpdate(userId, conversationId, {
    firstUserInput: data.content,
    shouldGenerateTitle,
    modelOverride: preferredModel
  })

  const assistantContent = await generateAssistantReply({
    latestUserMessage: data.content,
    conversationHistory: history
      .filter((message) => message.id !== userMessage.id)
      .map((message) => ({
        role: message.role,
        content: message.content
      })),
    memoryContext,
    modelOverride: preferredModel
  })

  const assistantMessage = await prisma.message.create({
    data: {
      conversationId,
      role: 'assistant',
      content: assistantContent
    }
  })

  scheduleUserMemoryExtraction(userId, {
    userMessage: data.content,
    existingMemories: memories,
    modelOverride: preferredModel
  })

  await conversationMetadataTask

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

  const existingMessageCount = await prisma.message.count({
    where: { conversationId }
  })
  const shouldGenerateTitle = existingMessageCount === 0

  const userMessage = await prisma.message.create({
    data: {
      conversationId,
      role: 'user',
      content: data.content
    }
  })

  handlers.onUserMessage(userMessage)

  const { history, memories, memoryContext } = await loadMessageGenerationContext(
    userId,
    conversationId
  )
  const preferredModel = await getModelNameForLLM(userId)
  const conversationMetadataTask = scheduleConversationMetadataUpdate(userId, conversationId, {
    firstUserInput: data.content,
    shouldGenerateTitle,
    modelOverride: preferredModel
  })

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
    modelOverride: preferredModel,
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

  scheduleUserMemoryExtraction(userId, {
    userMessage: data.content,
    existingMemories: memories,
    modelOverride: preferredModel
  })

  await conversationMetadataTask

  handlers.onAssistantDone({
    assistantMessage,
    conversationId
  })
}
