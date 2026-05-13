import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import {
  cancelMessageStream,
  createConversation,
  deleteConversation,
  deleteMessage as deleteMessageApi,
  fetchConversationDetail,
  fetchConversations,
  regenerateMessage,
  renameConversation,
  subscribeMessageStream,
  toggleConversationPin,
  streamMessage,
  updateMessage as updateMessageApi
} from '../api/chat'
import type {
  ConversationSummary,
  CreateConversationResponse,
  Message,
  StreamAssistantStatus
} from '../types/chat'

export const useChatStore = defineStore('chat', () => {
  const conversations = ref<ConversationSummary[]>([])
  const activeConversationId = ref('')
  const messages = ref<Message[]>([])
  const isLoadingConversations = ref(false)
  const isLoadingMessages = ref(false)
  const isSending = ref(false)
  const streamingStatusText = ref('')
  const streamingStatus = ref<StreamAssistantStatus | null>(null)
  const activeStreamingConversationId = ref('')
  const activeStreamingMessageId = ref('')

  let activeStreamAbortController: AbortController | null = null

  const activeConversation = computed(
    () =>
      conversations.value.find((conversation) => conversation.id === activeConversationId.value) ??
      null
  )

  function isAbortError(error: unknown) {
    return error instanceof Error && error.name === 'AbortError'
  }

  function upsertMessage(message: Message) {
    const index = messages.value.findIndex((item) => item.id === message.id)

    if (index === -1) {
      messages.value = [...messages.value, message]
      return
    }

    messages.value = messages.value.map((item, itemIndex) => (itemIndex === index ? message : item))
  }

  function updateMessage(messageId: string, updater: (message: Message) => Message) {
    messages.value = messages.value.map((message) =>
      message.id === messageId ? updater(message) : message
    )
  }

  function clearActiveStream(controller?: AbortController) {
    if (controller && activeStreamAbortController !== controller) {
      return
    }

    if (!controller || activeStreamAbortController === controller) {
      activeStreamAbortController = null
    }

    activeStreamingConversationId.value = ''
    activeStreamingMessageId.value = ''
    isSending.value = false
    streamingStatusText.value = ''
    streamingStatus.value = null
  }

  function detachActiveStream() {
    activeStreamAbortController?.abort()
    clearActiveStream()
  }

  function startActiveStreamSubscription(
    conversationId: string,
    controller: AbortController,
    messageId = ''
  ) {
    activeStreamAbortController = controller
    activeStreamingConversationId.value = conversationId
    activeStreamingMessageId.value = messageId
    isSending.value = true
  }

  function findGeneratingAssistantMessage() {
    return [...messages.value]
      .reverse()
      .find((message) => message.role === 'assistant' && message.status === 'generating')
  }

  function buildStreamHandlers(conversationId: string, controller: AbortController) {
    function isCurrentController() {
      return activeStreamAbortController === controller
    }

    function finalizeAssistantMessage(message: Message) {
      upsertMessage(message)

      if (isCurrentController() && activeStreamingMessageId.value === message.id) {
        clearActiveStream(controller)
      }

      void loadConversations(true)
    }

    return {
      onUserMessage(userMessage: Message) {
        if (!isCurrentController() || activeConversationId.value !== conversationId) {
          return
        }

        upsertMessage(userMessage)
        void loadConversations(true)
      },
      onAssistantMessage(assistantMessage: Message) {
        if (!isCurrentController() || activeConversationId.value !== conversationId) {
          return
        }

        upsertMessage(assistantMessage)

        if (assistantMessage.status === 'generating') {
          activeStreamingMessageId.value = assistantMessage.id
          activeStreamingConversationId.value = conversationId
          isSending.value = true
        } else {
          clearActiveStream(controller)
        }
      },
      onAssistantStatus(status: StreamAssistantStatus) {
        if (!isCurrentController() || activeConversationId.value !== conversationId) {
          return
        }

        streamingStatus.value = status
        streamingStatusText.value = status.text
      },
      onAssistantDelta(delta: string) {
        if (!isCurrentController() || activeConversationId.value !== conversationId) {
          return
        }

        if (!activeStreamingMessageId.value) {
          return
        }

        streamingStatus.value = null
        streamingStatusText.value = ''
        updateMessage(activeStreamingMessageId.value, (message) => ({
          ...message,
          content: `${message.content}${delta}`,
          status: 'generating',
          updatedAt: new Date().toISOString()
        }))
      },
      onAssistantDone(payload: { assistantMessage: Message; conversationId: string }) {
        if (payload.conversationId !== conversationId) {
          return
        }

        finalizeAssistantMessage(payload.assistantMessage)
      },
      onAssistantCancelled(payload: { assistantMessage: Message; conversationId: string }) {
        if (payload.conversationId !== conversationId) {
          return
        }

        finalizeAssistantMessage(payload.assistantMessage)
      },
      onAssistantFailed(payload: {
        assistantMessage: Message
        conversationId: string
        message: string
      }) {
        if (payload.conversationId !== conversationId) {
          return
        }

        finalizeAssistantMessage(payload.assistantMessage)
      }
    }
  }

  function resumeStreamIfNeeded(conversationId: string) {
    const generatingMessage = findGeneratingAssistantMessage()

    if (!generatingMessage) {
      clearActiveStream()
      return
    }

    detachActiveStream()

    const controller = new AbortController()
    startActiveStreamSubscription(conversationId, controller, generatingMessage.id)
    streamingStatus.value = {
      stage: 'thinking',
      text: generatingMessage.content ? '正在继续输出...' : '正在恢复输出...'
    }
    streamingStatusText.value = generatingMessage.content ? '' : '正在恢复输出...'

    void subscribeMessageStream(
      conversationId,
      generatingMessage.id,
      buildStreamHandlers(conversationId, controller),
      controller.signal
    )
      .catch((error) => {
        if (isAbortError(error)) {
          return
        }

        updateMessage(generatingMessage.id, (msg) => {
          if (msg.status === 'generating') return { ...msg, status: 'failed' }
          return msg
        })
        console.error('Failed to resume message stream:', error)
      })
      .finally(() => {
        if (activeStreamAbortController === controller) {
          clearActiveStream()
        }
      })
  }

  async function loadConversations(silent = false) {
    if (!silent) {
      isLoadingConversations.value = true
    }
    try {
      conversations.value = await fetchConversations()
      if (!activeConversationId.value && conversations.value[0]) {
        activeConversationId.value = conversations.value[0].id
      }
    } finally {
      isLoadingConversations.value = false
    }
  }

  async function createConversationAction(
    initialMessage?: string
  ): Promise<CreateConversationResponse> {
    const result = await createConversation({ initialMessage })
    if (!result.existed) {
      conversations.value = [result.conversation, ...conversations.value]
    }
    activeConversationId.value = result.conversation.id
    messages.value = []
    return result
  }

  async function selectConversation(conversationId: string) {
    detachActiveStream()
    activeConversationId.value = conversationId
    isLoadingMessages.value = true
    try {
      const detail = await fetchConversationDetail(conversationId)
      messages.value = detail.messages
      resumeStreamIfNeeded(conversationId)
    } finally {
      isLoadingMessages.value = false
    }
  }

  async function sendMessageAction(content: string) {
    if (!activeConversationId.value) {
      const result = await createConversationAction(content)
      activeConversationId.value = result.conversation.id
    }

    const conversationId = activeConversationId.value
    detachActiveStream()

    const controller = new AbortController()
    startActiveStreamSubscription(conversationId, controller)
    streamingStatus.value = {
      stage: 'thinking',
      text: '正在思考问题...'
    }
    streamingStatusText.value = '正在思考问题...'

    // Optimistic UI: show user message immediately
    const tempId = `temp-user-${Date.now()}`
    messages.value = [
      ...messages.value,
      {
        id: tempId,
        conversationId,
        role: 'user' as const,
        content,
        fileList: [],
        status: 'completed' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ]

    try {
      const handlers = buildStreamHandlers(conversationId, controller)
      handlers.onUserMessage = (userMessage) => {
        messages.value = messages.value.map((m) =>
          m.id === tempId ? userMessage : m
        )
        void loadConversations(true)
      }

      const result = await streamMessage(
        conversationId,
        { content },
        handlers,
        controller.signal
      )

      activeConversationId.value = result.conversationId
      return result
    } catch (error) {
      if (isAbortError(error)) {
        return {
          conversationId,
          assistantMessageId: activeStreamingMessageId.value || undefined
        }
      }

      const failedMessageId = activeStreamingMessageId.value
      if (failedMessageId) {
        updateMessage(failedMessageId, (msg) => {
          if (msg.status === 'generating') return { ...msg, status: 'failed' }
          return msg
        })
      }
      console.error('Stream message error:', error)
      return {
        conversationId,
        assistantMessageId: failedMessageId || undefined
      }
    } finally {
      if (activeStreamAbortController === controller) {
        clearActiveStream()
      }
    }
  }

  async function stopStreamingAction() {
    const conversationId = activeStreamingConversationId.value || activeConversationId.value
    const messageId = activeStreamingMessageId.value || findGeneratingAssistantMessage()?.id

    if (!conversationId || !messageId) {
      return
    }

    updateMessage(messageId, (message) => ({
      ...message,
      status: 'cancelled',
      updatedAt: new Date().toISOString()
    }))

    detachActiveStream()

    const result = await cancelMessageStream(conversationId, messageId)
    upsertMessage(result.assistantMessage)
    await loadConversations(true)
  }

  async function renameConversationAction(conversationId: string, title: string) {
    const updatedConversation = await renameConversation(conversationId, title)
    conversations.value = conversations.value.map((conversation) =>
      conversation.id === conversationId
        ? { ...conversation, ...updatedConversation }
        : conversation
    )
  }

  async function toggleConversationPinAction(conversationId: string, isPinned: boolean) {
    await toggleConversationPin(conversationId, isPinned)
    await loadConversations(true)
  }

  async function deleteConversationAction(conversationId: string) {
    await deleteConversation(conversationId)
    conversations.value = conversations.value.filter(
      (conversation) => conversation.id !== conversationId
    )

    if (activeConversationId.value === conversationId) {
      activeConversationId.value = conversations.value[0]?.id ?? ''
      messages.value = []

      if (activeConversationId.value) {
        await selectConversation(activeConversationId.value)
      }
    }
  }

  async function updateMessageAction(messageId: string, content: string) {
    if (!activeConversationId.value) return
    const conversationId = activeConversationId.value

    const updated = await updateMessageApi(conversationId, messageId, content)

    const editedIndex = messages.value.findIndex((m) => m.id === messageId)
    if (editedIndex === -1) return

    messages.value = [...messages.value.slice(0, editedIndex), updated]

    detachActiveStream()

    const controller = new AbortController()
    startActiveStreamSubscription(conversationId, controller)
    streamingStatus.value = {
      stage: 'thinking',
      text: '正在根据编辑内容重新生成...'
    }
    streamingStatusText.value = '正在根据编辑内容重新生成...'

    try {
      await regenerateMessage(
        conversationId,
        messageId,
        buildStreamHandlers(conversationId, controller),
        controller.signal
      )
    } catch (error) {
      if (isAbortError(error)) return

      const failedMessageId = activeStreamingMessageId.value
      if (failedMessageId) {
        updateMessage(failedMessageId, (msg) => {
          if (msg.status === 'generating') return { ...msg, status: 'failed' }
          return msg
        })
      }
      console.error('Regenerate message error:', error)
    } finally {
      if (activeStreamAbortController === controller) {
        clearActiveStream()
      }
    }
  }

  async function deleteMessageAction(messageId: string) {
    if (!activeConversationId.value) return
    await deleteMessageApi(activeConversationId.value, messageId)
    messages.value = messages.value.filter((m) => m.id !== messageId)
  }

  return {
    conversations,
    activeConversationId,
    activeConversation,
    messages,
    isLoadingConversations,
    isLoadingMessages,
    isSending,
    streamingStatusText,
    streamingStatus,
    activeStreamingConversationId,
    activeStreamingMessageId,
    loadConversations,
    createConversation: createConversationAction,
    selectConversation,
    sendMessage: sendMessageAction,
    stopStreaming: stopStreamingAction,
    detachActiveStream,
    renameConversation: renameConversationAction,
    toggleConversationPin: toggleConversationPinAction,
    deleteConversation: deleteConversationAction,
    updateMessage: updateMessageAction,
    deleteMessage: deleteMessageAction
  }
})
