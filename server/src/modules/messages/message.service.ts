import { MessageStatus, type Message as PrismaMessage } from '@prisma/client'

import { prisma } from '../../lib/prisma'
import {
  generateAssistantReply,
  generateConversationTitle,
  streamAssistantReply
} from '../../lib/ai'
import { serializeMessageForClient, type ClientMessage } from '../../utils/message-files'
import { runLongTermMemoryGraph } from '../../lib/memory-graph'
import { AppError } from '../../utils/app-error'
import {
  ensureConversationOwnership,
  updateConversation
} from '../conversations/conversation.service'
import { getModelNameForLLM } from '../model-preferences/model-preference.service'
import type { CreateMessageBody } from './message.schema'

const STREAM_PERSIST_INTERVAL_MS = 400
const STREAM_PERSIST_MIN_CHARS = 80

type AssistantStatusPayload = {
  stage: 'thinking' | 'tool' | 'reasoning'
  text: string
  toolName?: string
}

type StreamMessageHandlers = {
  onUserMessage?: (payload: ClientMessage) => void
  onAssistantMessage?: (payload: ClientMessage) => void
  onAssistantStatus?: (payload: AssistantStatusPayload) => void
  onAssistantDelta?: (delta: string) => void
  onAssistantDone?: (payload: { assistantMessage: ClientMessage; conversationId: string }) => void
  onAssistantCancelled?: (payload: {
    assistantMessage: ClientMessage
    conversationId: string
  }) => void
  onAssistantFailed?: (payload: {
    assistantMessage: ClientMessage
    conversationId: string
    message: string
  }) => void
}

type StreamTask = {
  assistantMessage: PrismaMessage
  userId: string
  latestUserMessage: string
  existingMemories: MessageGenerationContext['memories']
  modelOverride?: string
  memoryContext: string[]
  conversationHistory: Array<{
    role: 'user' | 'assistant' | 'system'
    content: string
  }>
  subscribers: Set<StreamMessageHandlers>
  latestStatus: AssistantStatusPayload | null
  abortController: AbortController
  cancelRequested: boolean
  completion: Promise<void>
  resolveCompletion: () => void
  lastPersistedContent: string
  lastPersistedStatus: MessageStatus
  lastPersistedAt: number
  flushPromise: Promise<void>
  conversationMetadataTask: Promise<void>
}

const activeStreamTasks = new Map<string, StreamTask>()

type MessageGenerationContext = {
  history: Array<{
    id: string
    role: 'user' | 'assistant' | 'system'
    content: string
  }>
  memories: Array<{
    id: string
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
      id: memory.id,
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
    const result = await runLongTermMemoryGraph({
      userId,
      userMessage: payload.userMessage,
      existingMemories: payload.existingMemories,
      modelOverride: payload.modelOverride
    })

    console.log('Auto memory graph completed:', result.persistResult)
  })().catch((error) => {
    console.error('Failed to extract user memories:', error)
  })
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === 'AbortError'
}

function cloneMessage(message: PrismaMessage): PrismaMessage {
  return {
    ...message,
    createdAt: new Date(message.createdAt),
    updatedAt: new Date(message.updatedAt)
  }
}

function broadcastToTask(task: StreamTask, callback: (handlers: StreamMessageHandlers) => void) {
  for (const handlers of task.subscribers) {
    try {
      callback(handlers)
    } catch (error) {
      console.error('Failed to broadcast stream event:', error)
    }
  }
}

function subscribeToTask(
  task: StreamTask,
  handlers: StreamMessageHandlers,
  options?: { replayAssistantMessage?: boolean }
) {
  task.subscribers.add(handlers)

  if (options?.replayAssistantMessage) {
    handlers.onAssistantMessage?.(serializeMessageForClient(cloneMessage(task.assistantMessage)))

    if (task.latestStatus && task.assistantMessage.status === MessageStatus.generating) {
      handlers.onAssistantStatus?.(task.latestStatus)
    }
  }

  return () => {
    task.subscribers.delete(handlers)
  }
}

function waitForAbort(signal?: AbortSignal) {
  if (!signal) {
    return new Promise<void>(() => undefined)
  }

  if (signal.aborted) {
    return Promise.resolve()
  }

  return new Promise<void>((resolve) => {
    signal.addEventListener('abort', () => resolve(), { once: true })
  })
}

async function waitForTaskSubscription(
  task: StreamTask,
  handlers: StreamMessageHandlers,
  signal?: AbortSignal,
  options?: { replayAssistantMessage?: boolean }
) {
  if (signal?.aborted) {
    return
  }

  const unsubscribe = subscribeToTask(task, handlers, options)

  try {
    await Promise.race([task.completion, waitForAbort(signal)])
  } finally {
    unsubscribe()
  }
}

async function persistTaskMessage(task: StreamTask, force = false) {
  const contentChanged = task.assistantMessage.content !== task.lastPersistedContent
  const statusChanged = task.assistantMessage.status !== task.lastPersistedStatus

  if (!force) {
    if (!contentChanged && !statusChanged) {
      return
    }

    const charDiff = task.assistantMessage.content.length - task.lastPersistedContent.length

    if (
      Date.now() - task.lastPersistedAt < STREAM_PERSIST_INTERVAL_MS &&
      charDiff < STREAM_PERSIST_MIN_CHARS &&
      !statusChanged
    ) {
      return
    }
  }

  task.flushPromise = task.flushPromise.then(async () => {
    const persisted = await prisma.message.update({
      where: { id: task.assistantMessage.id },
      data: {
        content: task.assistantMessage.content,
        status: task.assistantMessage.status
      }
    })

    task.assistantMessage = persisted
    task.lastPersistedContent = persisted.content
    task.lastPersistedStatus = persisted.status
    task.lastPersistedAt = Date.now()
  })

  await task.flushPromise
}

async function finalizeTaskAsCancelled(task: StreamTask) {
  task.latestStatus = null
  task.assistantMessage = {
    ...task.assistantMessage,
    status: MessageStatus.cancelled,
    updatedAt: new Date()
  }

  await persistTaskMessage(task, true)
  await task.conversationMetadataTask

  broadcastToTask(task, (handlers) => {
    handlers.onAssistantCancelled?.({
      assistantMessage: serializeMessageForClient(cloneMessage(task.assistantMessage)),
      conversationId: task.assistantMessage.conversationId
    })
  })
}

async function finalizeTaskAsFailed(task: StreamTask, error: unknown) {
  task.latestStatus = null
  task.assistantMessage = {
    ...task.assistantMessage,
    status: MessageStatus.failed,
    updatedAt: new Date()
  }

  await persistTaskMessage(task, true)
  await task.conversationMetadataTask

  const message = error instanceof Error ? error.message : '流式消息处理失败'

  broadcastToTask(task, (handlers) => {
    handlers.onAssistantFailed?.({
      assistantMessage: serializeMessageForClient(cloneMessage(task.assistantMessage)),
      conversationId: task.assistantMessage.conversationId,
      message
    })
  })
}

async function finalizeTaskAsCompleted(task: StreamTask) {
  task.latestStatus = null
  task.assistantMessage = {
    ...task.assistantMessage,
    status: MessageStatus.completed,
    updatedAt: new Date()
  }

  await persistTaskMessage(task, true)

  scheduleUserMemoryExtraction(task.userId, {
    userMessage: task.latestUserMessage,
    existingMemories: task.existingMemories,
    modelOverride: task.modelOverride
  })

  await task.conversationMetadataTask

  broadcastToTask(task, (handlers) => {
    handlers.onAssistantDone?.({
      assistantMessage: serializeMessageForClient(cloneMessage(task.assistantMessage)),
      conversationId: task.assistantMessage.conversationId
    })
  })
}

function startStreamTask(task: StreamTask) {
  activeStreamTasks.set(task.assistantMessage.id, task)

  void (async () => {
    try {
      const stream = streamAssistantReply({
        latestUserMessage: task.latestUserMessage,
        conversationHistory: task.conversationHistory,
        memoryContext: task.memoryContext,
        modelOverride: task.modelOverride,
        signal: task.abortController.signal,
        onStatusChange(payload) {
          if (task.cancelRequested) {
            return
          }

          task.latestStatus = payload
          broadcastToTask(task, (handlers) => {
            handlers.onAssistantStatus?.(payload)
          })
        }
      })

      for await (const delta of stream) {
        if (task.cancelRequested) {
          break
        }

        task.assistantMessage = {
          ...task.assistantMessage,
          content: `${task.assistantMessage.content}${delta}`,
          updatedAt: new Date(),
          status: MessageStatus.generating
        }

        broadcastToTask(task, (handlers) => {
          handlers.onAssistantDelta?.(delta)
        })

        void persistTaskMessage(task).catch((error) => {
          console.error('Failed to persist streaming message chunk:', error)
        })
      }

      if (task.cancelRequested || task.abortController.signal.aborted) {
        await finalizeTaskAsCancelled(task)
        return
      }

      await finalizeTaskAsCompleted(task)
    } catch (error) {
      if (task.cancelRequested || isAbortError(error)) {
        await finalizeTaskAsCancelled(task)
        return
      }

      await finalizeTaskAsFailed(task, error)
    } finally {
      activeStreamTasks.delete(task.assistantMessage.id)
      task.resolveCompletion()
    }
  })()
}

function createStreamTask(params: {
  assistantMessage: PrismaMessage
  userId: string
  latestUserMessage: string
  existingMemories: MessageGenerationContext['memories']
  modelOverride?: string
  memoryContext: string[]
  conversationHistory: Array<{
    role: 'user' | 'assistant' | 'system'
    content: string
  }>
  conversationMetadataTask: Promise<void>
}) {
  let resolveCompletion: () => void = () => undefined

  const task: StreamTask = {
    assistantMessage: params.assistantMessage,
    userId: params.userId,
    latestUserMessage: params.latestUserMessage,
    existingMemories: params.existingMemories,
    modelOverride: params.modelOverride,
    memoryContext: params.memoryContext,
    conversationHistory: params.conversationHistory,
    subscribers: new Set(),
    latestStatus: null,
    abortController: new AbortController(),
    cancelRequested: false,
    completion: new Promise<void>((resolve) => {
      resolveCompletion = resolve
    }),
    resolveCompletion,
    lastPersistedContent: params.assistantMessage.content,
    lastPersistedStatus: params.assistantMessage.status,
    lastPersistedAt: Date.now(),
    flushPromise: Promise.resolve(),
    conversationMetadataTask: params.conversationMetadataTask
  }

  startStreamTask(task)

  return task
}

async function ensureNoGeneratingMessage(conversationId: string) {
  const existingGeneratingMessage = await prisma.message.findFirst({
    where: {
      conversationId,
      role: 'assistant',
      status: MessageStatus.generating
    },
    select: { id: true }
  })

  if (existingGeneratingMessage) {
    throw new AppError(
      409,
      '当前会话仍有消息在生成中，请先等待完成或手动停止',
      'MESSAGE_STREAM_BUSY'
    )
  }
}

async function getAssistantMessageOrThrow(
  userId: string,
  conversationId: string,
  messageId: string
) {
  await ensureConversationOwnership(userId, conversationId)

  const message = await prisma.message.findFirst({
    where: {
      id: messageId,
      conversationId,
      role: 'assistant'
    }
  })

  if (!message) {
    throw new AppError(404, '消息不存在', 'NOT_FOUND')
  }

  return message
}

async function markOrphanGeneratingMessageAsFailed(messageId: string) {
  return prisma.message.update({
    where: { id: messageId },
    data: {
      status: MessageStatus.failed
    }
  })
}

export async function listMessages(userId: string, conversationId: string) {
  await ensureConversationOwnership(userId, conversationId)

  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' }
  })

  return { messages: messages.map(serializeMessageForClient) }
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
      content: assistantContent,
      status: MessageStatus.completed
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
    userMessage: serializeMessageForClient(userMessage),
    assistantMessage: serializeMessageForClient(assistantMessage)
  }
}

export async function streamMessage(
  userId: string,
  conversationId: string,
  data: CreateMessageBody,
  handlers: StreamMessageHandlers,
  signal?: AbortSignal
) {
  await ensureConversationOwnership(userId, conversationId)
  await ensureNoGeneratingMessage(conversationId)

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
  const assistantMessage = await prisma.message.create({
    data: {
      conversationId,
      role: 'assistant',
      content: '',
      status: MessageStatus.generating
    }
  })

  handlers.onUserMessage?.(serializeMessageForClient(userMessage))
  handlers.onAssistantMessage?.(serializeMessageForClient(assistantMessage))

  try {
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

    const task = createStreamTask({
      assistantMessage,
      userId,
      latestUserMessage: data.content,
      existingMemories: memories,
      modelOverride: preferredModel,
      memoryContext,
      conversationHistory: history
        .filter((message) => message.id !== userMessage.id && message.id !== assistantMessage.id)
        .map((message) => ({
          role: message.role,
          content: message.content
        })),
      conversationMetadataTask
    })

    await waitForTaskSubscription(task, handlers, signal)
  } catch (error) {
    const failedAssistantMessage = await prisma.message.update({
      where: { id: assistantMessage.id },
      data: {
        status: MessageStatus.failed
      }
    })

    handlers.onAssistantFailed?.({
      assistantMessage: serializeMessageForClient(failedAssistantMessage),
      conversationId,
      message: error instanceof Error ? error.message : '流式消息处理失败'
    })

    throw error
  }

  return {
    conversationId,
    assistantMessageId: assistantMessage.id
  }
}

export async function subscribeMessageStream(
  userId: string,
  conversationId: string,
  messageId: string,
  handlers: StreamMessageHandlers,
  signal?: AbortSignal
) {
  let assistantMessage = await getAssistantMessageOrThrow(userId, conversationId, messageId)
  const task = activeStreamTasks.get(messageId)

  if (task) {
    await waitForTaskSubscription(task, handlers, signal, {
      replayAssistantMessage: true
    })

    return {
      conversationId,
      assistantMessageId: messageId
    }
  }

  if (assistantMessage.status === MessageStatus.generating) {
    assistantMessage = await markOrphanGeneratingMessageAsFailed(messageId)
  }

  handlers.onAssistantMessage?.(serializeMessageForClient(assistantMessage))

  if (assistantMessage.status === MessageStatus.completed) {
    handlers.onAssistantDone?.({
      assistantMessage: serializeMessageForClient(assistantMessage),
      conversationId
    })
  } else if (assistantMessage.status === MessageStatus.cancelled) {
    handlers.onAssistantCancelled?.({
      assistantMessage: serializeMessageForClient(assistantMessage),
      conversationId
    })
  } else if (assistantMessage.status === MessageStatus.failed) {
    handlers.onAssistantFailed?.({
      assistantMessage: serializeMessageForClient(assistantMessage),
      conversationId,
      message: '流式输出已终止'
    })
  }

  return {
    conversationId,
    assistantMessageId: messageId
  }
}

export async function cancelMessageStream(
  userId: string,
  conversationId: string,
  messageId: string
) {
  const assistantMessage = await getAssistantMessageOrThrow(userId, conversationId, messageId)
  const task = activeStreamTasks.get(messageId)

  if (!task) {
    if (assistantMessage.status === MessageStatus.generating) {
      const cancelledMessage = await prisma.message.update({
        where: { id: assistantMessage.id },
        data: {
          status: MessageStatus.cancelled
        }
      })

      return serializeMessageForClient(cancelledMessage)
    }

    return serializeMessageForClient(assistantMessage)
  }

  task.cancelRequested = true
  task.abortController.abort()

  return serializeMessageForClient({
    ...assistantMessage,
    status: MessageStatus.cancelled,
    updatedAt: new Date()
  })
}
