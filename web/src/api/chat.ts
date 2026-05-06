import type { ApiResponse } from '../types/api'
import type {
  ConversationDetail,
  ConversationSummary,
  CreateConversationInput,
  CreateMessageInput,
  Message,
  StreamAssistantStatus
} from '../types/chat'
import { ensureFetchResponseOk, fetchWithAuth, http } from './http'
import { consumeSseStream, type SseEvent } from './sse'

type StreamMessageHandlers = {
  onUserMessage?: (message: Message) => void
  onAssistantMessage?: (message: Message) => void
  onAssistantStatus?: (status: StreamAssistantStatus) => void
  onAssistantDelta?: (delta: string) => void
  onAssistantDone?: (payload: { assistantMessage: Message; conversationId: string }) => void
  onAssistantCancelled?: (payload: { assistantMessage: Message; conversationId: string }) => void
  onAssistantFailed?: (payload: {
    assistantMessage: Message
    conversationId: string
    message: string
  }) => void
}

type StreamState = {
  latestConversationId: string
  latestAssistantMessageId: string
}

function applyStreamEvent(
  parsed: SseEvent,
  handlers: StreamMessageHandlers,
  state: StreamState,
  fallbackMessage: string
) {
  if (parsed.event === 'user-message' && parsed.data) {
    handlers.onUserMessage?.(parsed.data as Message)
    return
  }

  if (parsed.event === 'assistant-message' && parsed.data) {
    const assistantMessage = parsed.data as Message
    state.latestAssistantMessageId = assistantMessage.id
    handlers.onAssistantMessage?.(assistantMessage)
    return
  }

  if (parsed.event === 'assistant-status' && parsed.data) {
    handlers.onAssistantStatus?.(parsed.data as StreamAssistantStatus)
    return
  }

  if (parsed.event === 'assistant-delta' && parsed.data) {
    handlers.onAssistantDelta?.((parsed.data as { delta: string }).delta)
    return
  }

  if (parsed.event === 'assistant-done' && parsed.data) {
    const payload = parsed.data as { assistantMessage: Message; conversationId: string }
    state.latestConversationId = payload.conversationId
    state.latestAssistantMessageId = payload.assistantMessage.id
    handlers.onAssistantDone?.(payload)
    return
  }

  if (parsed.event === 'assistant-cancelled' && parsed.data) {
    const payload = parsed.data as { assistantMessage: Message; conversationId: string }
    state.latestConversationId = payload.conversationId
    state.latestAssistantMessageId = payload.assistantMessage.id
    handlers.onAssistantCancelled?.(payload)
    return
  }

  if (parsed.event === 'assistant-failed' && parsed.data) {
    const payload = parsed.data as {
      assistantMessage: Message
      conversationId: string
      message: string
    }
    state.latestConversationId = payload.conversationId
    state.latestAssistantMessageId = payload.assistantMessage.id
    handlers.onAssistantFailed?.(payload)
    return
  }

  if (parsed.event === 'error' && parsed.data) {
    const payload = parsed.data as { message?: string }
    throw new Error(payload.message || fallbackMessage)
  }
}

export async function fetchConversations(): Promise<ConversationSummary[]> {
  const response =
    await http.get<ApiResponse<{ conversations: ConversationSummary[] }>>('/conversations')
  return response.data.data.conversations
}

export async function createConversation(
  input: CreateConversationInput
): Promise<ConversationSummary> {
  const response = await http.post<ApiResponse<ConversationSummary>>('/conversations', input)
  return response.data.data
}

export async function fetchConversationDetail(conversationId: string): Promise<ConversationDetail> {
  const response = await http.get<ApiResponse<ConversationDetail>>(
    `/conversations/${conversationId}`
  )
  return response.data.data
}

export async function renameConversation(
  conversationId: string,
  title: string
): Promise<ConversationSummary> {
  const response = await http.patch<ApiResponse<ConversationSummary>>(
    `/conversations/${conversationId}`,
    {
      title
    }
  )
  return response.data.data
}

export async function deleteConversation(conversationId: string): Promise<void> {
  await http.delete(`/conversations/${conversationId}`)
}

export async function toggleConversationPin(
  conversationId: string,
  isPinned: boolean
): Promise<ConversationSummary> {
  const response = await http.patch<ApiResponse<ConversationSummary>>(
    `/conversations/${conversationId}/pin`,
    {
      isPinned
    }
  )
  return response.data.data
}

export async function fetchMessages(conversationId: string): Promise<Message[]> {
  const response = await http.get<ApiResponse<{ messages: Message[] }>>(
    `/conversations/${conversationId}/messages`
  )
  return response.data.data.messages
}

export async function sendMessage(
  conversationId: string,
  input: CreateMessageInput
): Promise<{ userMessage: Message; assistantMessage: Message; conversationId: string }> {
  const response = await http.post<
    ApiResponse<{ userMessage: Message; assistantMessage: Message; conversationId: string }>
  >(`/conversations/${conversationId}/messages`, input)
  return response.data.data
}

export async function streamMessage(
  conversationId: string,
  input: CreateMessageInput,
  handlers: StreamMessageHandlers,
  signal?: AbortSignal
): Promise<{ conversationId: string; assistantMessageId?: string }> {
  const state: StreamState = {
    latestConversationId: conversationId,
    latestAssistantMessageId: ''
  }

  const response = await fetchWithAuth(`/conversations/${conversationId}/messages/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream'
    },
    body: JSON.stringify(input),
    signal
  })

  await ensureFetchResponseOk(response, '流式请求失败')

  await consumeSseStream(response, (parsed) => {
    applyStreamEvent(parsed, handlers, state, '流式请求失败')
  })

  return {
    conversationId: state.latestConversationId,
    assistantMessageId: state.latestAssistantMessageId || undefined
  }
}

export async function subscribeMessageStream(
  conversationId: string,
  messageId: string,
  handlers: StreamMessageHandlers,
  signal?: AbortSignal
): Promise<{ conversationId: string; assistantMessageId?: string }> {
  const state: StreamState = {
    latestConversationId: conversationId,
    latestAssistantMessageId: messageId
  }

  const response = await fetchWithAuth(
    `/conversations/${conversationId}/messages/${messageId}/stream`,
    {
      method: 'GET',
      headers: {
        Accept: 'text/event-stream'
      },
      signal
    }
  )

  await ensureFetchResponseOk(response, '恢复流式请求失败')

  await consumeSseStream(response, (parsed) => {
    applyStreamEvent(parsed, handlers, state, '恢复流式请求失败')
  })

  return {
    conversationId: state.latestConversationId,
    assistantMessageId: state.latestAssistantMessageId || undefined
  }
}

export async function streamAudioMessage(
  conversationId: string,
  audioBlob: Blob,
  handlers: StreamMessageHandlers,
  signal?: AbortSignal
): Promise<{ conversationId: string; assistantMessageId?: string }> {
  const state: StreamState = {
    latestConversationId: conversationId,
    latestAssistantMessageId: ''
  }

  const formData = new FormData()
  formData.append('audio', audioBlob, 'recording.webm')

  const response = await fetchWithAuth(`/conversations/${conversationId}/messages/audio`, {
    method: 'POST',
    headers: {
      Accept: 'text/event-stream'
    },
    body: formData,
    signal
  })

  await ensureFetchResponseOk(response, '语音消息请求失败')

  await consumeSseStream(response, (parsed) => {
    applyStreamEvent(parsed, handlers, state, '语音消息请求失败')
  })

  return {
    conversationId: state.latestConversationId,
    assistantMessageId: state.latestAssistantMessageId || undefined
  }
}

export async function cancelMessageStream(conversationId: string, messageId: string) {
  const response = await http.post<
    ApiResponse<{ assistantMessage: Message; conversationId: string }>
  >(`/conversations/${conversationId}/messages/${messageId}/cancel`)

  return response.data.data
}
