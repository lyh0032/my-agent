import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import {
  createConversation,
  deleteConversation,
  fetchConversationDetail,
  fetchConversations,
  renameConversation,
  streamMessage
} from '../api/chat'
import type { ConversationSummary, Message } from '../types/chat'

export const useChatStore = defineStore('chat', () => {
  const conversations = ref<ConversationSummary[]>([])
  const activeConversationId = ref('')
  const messages = ref<Message[]>([])
  const isLoadingConversations = ref(false)
  const isLoadingMessages = ref(false)
  const isSending = ref(false)

  const activeConversation = computed(
    () =>
      conversations.value.find((conversation) => conversation.id === activeConversationId.value) ??
      null
  )

  async function loadConversations() {
    isLoadingConversations.value = true
    try {
      conversations.value = await fetchConversations()
      if (!activeConversationId.value && conversations.value[0]) {
        activeConversationId.value = conversations.value[0].id
      }
    } finally {
      isLoadingConversations.value = false
    }
  }

  async function createConversationAction(initialMessage?: string) {
    const conversation = await createConversation({ initialMessage })
    conversations.value = [conversation, ...conversations.value]
    activeConversationId.value = conversation.id
    messages.value = []
    return conversation
  }

  async function selectConversation(conversationId: string) {
    activeConversationId.value = conversationId
    isLoadingMessages.value = true
    try {
      const detail = await fetchConversationDetail(conversationId)
      messages.value = detail.messages
    } finally {
      isLoadingMessages.value = false
    }
  }

  async function sendMessageAction(content: string) {
    if (!activeConversationId.value) {
      const conversation = await createConversationAction(content)
      activeConversationId.value = conversation.id
    }

    isSending.value = true
    const conversationId = activeConversationId.value
    const streamingAssistantId = `assistant-stream-${Date.now()}`
    let hasStreamingAssistant = false

    try {
      const result = await streamMessage(
        conversationId,
        { content },
        {
          onUserMessage(userMessage) {
            messages.value = [...messages.value, userMessage]
          },
          onAssistantDelta(delta) {
            if (!hasStreamingAssistant) {
              hasStreamingAssistant = true
              messages.value = [
                ...messages.value,
                {
                  id: streamingAssistantId,
                  conversationId,
                  role: 'assistant',
                  content: delta,
                  createdAt: new Date().toISOString()
                }
              ]
              return
            }

            messages.value = messages.value.map((message) =>
              message.id === streamingAssistantId
                ? { ...message, content: `${message.content}${delta}` }
                : message
            )
          },
          onAssistantDone(payload) {
            messages.value = hasStreamingAssistant
              ? messages.value.map((message) =>
                  message.id === streamingAssistantId ? payload.assistantMessage : message
                )
              : [...messages.value, payload.assistantMessage]
          }
        }
      )

      await loadConversations()
      activeConversationId.value = result.conversationId
      return result
    } catch (error) {
      if (hasStreamingAssistant) {
        messages.value = messages.value.map((message) =>
          message.id === streamingAssistantId
            ? {
                ...message,
                content: message.content ? `${message.content}\n\n[流式输出中断]` : '[流式输出中断]'
              }
            : message
        )
      }

      throw error
    } finally {
      isSending.value = false
    }
  }

  async function renameConversationAction(conversationId: string, title: string) {
    const updatedConversation = await renameConversation(conversationId, title)
    conversations.value = conversations.value.map((conversation) =>
      conversation.id === conversationId
        ? { ...conversation, ...updatedConversation }
        : conversation
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
    loadConversations,
    createConversation: createConversationAction,
    selectConversation,
    sendMessage: sendMessageAction,
    renameConversation: renameConversationAction,
    deleteConversation: deleteConversationAction
  }
})
