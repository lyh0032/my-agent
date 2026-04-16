import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import {
  cancelMessageStream,
  createConversation,
  deleteConversation,
  fetchConversationDetail,
  fetchConversations,
  renameConversation,
  subscribeMessageStream,
  toggleConversationPin,
  streamMessage
} from '../api/chat'
import type { ConversationSummary, Message } from '../types/chat'

function sortConversations(conversations: ConversationSummary[]) {
  return [...conversations].sort((left, right) => {
    if (left.isPinned !== right.isPinned) {
      return left.isPinned ? -1 : 1
    }

    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
  })
}

export const useChatStore = defineStore('chat', () => {
  const conversations = ref<ConversationSummary[]>([])
  const activeConversationId = ref('')
  const messages = ref<Message[]>([])
  const isLoadingConversations = ref(false)
  const isLoadingMessages = ref(false)
  const isSending = ref(false)
  const streamingStatusText = ref('')
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
      if (!isCurrentController()) {
        return
      }

      upsertMessage(message)

      if (activeStreamingMessageId.value === message.id) {
        clearActiveStream(controller)
      }

      void loadConversations()
    }

    return {
      onUserMessage(userMessage: Message) {
        if (!isCurrentController() || activeConversationId.value !== conversationId) {
          return
        }

        upsertMessage(userMessage)
        void loadConversations()
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

        void loadConversations()
      },
      onAssistantStatus(status: { stage: 'thinking' | 'tool' | 'reasoning'; text: string }) {
        if (!isCurrentController() || activeConversationId.value !== conversationId) {
          return
        }

        streamingStatusText.value = status.text
      },
      onAssistantDelta(delta: string) {
        if (!isCurrentController() || activeConversationId.value !== conversationId) {
          return
        }

        if (!activeStreamingMessageId.value) {
          return
        }

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

        console.error('Failed to resume message stream:', error)
        clearActiveStream(controller)
      })
      .finally(() => {
        const stillGenerating = messages.value.some(
          (message) => message.id === generatingMessage.id && message.status === 'generating'
        )

        if (!stillGenerating) {
          clearActiveStream(controller)
        }
      })
  }

  async function loadConversations() {
    isLoadingConversations.value = true
    try {
      conversations.value = sortConversations(await fetchConversations())
      if (!activeConversationId.value && conversations.value[0]) {
        activeConversationId.value = conversations.value[0].id
      }
    } finally {
      isLoadingConversations.value = false
    }
  }

  async function createConversationAction(initialMessage?: string) {
    const conversation = await createConversation({ initialMessage })
    conversations.value = sortConversations([conversation, ...conversations.value])
    activeConversationId.value = conversation.id
    messages.value = []
    return conversation
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
      const conversation = await createConversationAction(content)
      activeConversationId.value = conversation.id
    }

    const conversationId = activeConversationId.value
    detachActiveStream()

    const controller = new AbortController()
    startActiveStreamSubscription(conversationId, controller)
    streamingStatusText.value = '正在思考问题...'

    try {
      const result = await streamMessage(
        conversationId,
        { content },
        buildStreamHandlers(conversationId, controller),
        controller.signal
      )

      await loadConversations()
      activeConversationId.value = result.conversationId
      return result
    } catch (error) {
      if (isAbortError(error)) {
        return {
          conversationId,
          assistantMessageId: activeStreamingMessageId.value || undefined
        }
      }

      throw error
    } finally {
      const stillGenerating = messages.value.some(
        (message) =>
          message.id === activeStreamingMessageId.value && message.status === 'generating'
      )

      if (!stillGenerating) {
        clearActiveStream(controller)
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
    await loadConversations()
  }

  async function renameConversationAction(conversationId: string, title: string) {
    const updatedConversation = await renameConversation(conversationId, title)
    conversations.value = sortConversations(
      conversations.value.map((conversation) =>
        conversation.id === conversationId
          ? { ...conversation, ...updatedConversation }
          : conversation
      )
    )
  }

  async function toggleConversationPinAction(conversationId: string, isPinned: boolean) {
    const updatedConversation = await toggleConversationPin(conversationId, isPinned)
    conversations.value = sortConversations(
      conversations.value.map((conversation) =>
        conversation.id === conversationId
          ? {
              ...conversation,
              ...updatedConversation,
              lastMessagePreview: conversation.lastMessagePreview,
              messageCount: conversation.messageCount
            }
          : conversation
      )
    )
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

  return {
    conversations,
    activeConversationId,
    activeConversation,
    messages,
    isLoadingConversations,
    isLoadingMessages,
    isSending,
    streamingStatusText,
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
    deleteConversation: deleteConversationAction
  }
})
