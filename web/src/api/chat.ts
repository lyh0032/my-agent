import type { ApiResponse } from '../types/api'
import type {
  ConversationDetail,
  ConversationSummary,
  CreateConversationInput,
  CreateMessageInput,
  Message
} from '../types/chat'
import { clearStoredToken, getStoredToken } from '../utils/token'
import { apiBaseUrl, http } from './http'

type StreamMessageHandlers = {
  onUserMessage?: (message: Message) => void
  onAssistantDelta?: (delta: string) => void
  onAssistantDone?: (payload: { assistantMessage: Message; conversationId: string }) => void
}

type ParsedSseEvent = {
  event: string
  data: unknown
}

function findSseBoundary(buffer: string): { index: number; length: number } | null {
  const crlfBoundaryIndex = buffer.indexOf('\r\n\r\n')

  if (crlfBoundaryIndex >= 0) {
    return {
      index: crlfBoundaryIndex,
      length: 4
    }
  }

  const lfBoundaryIndex = buffer.indexOf('\n\n')

  if (lfBoundaryIndex >= 0) {
    return {
      index: lfBoundaryIndex,
      length: 2
    }
  }

  return null
}

function parseSseEvent(chunk: string): ParsedSseEvent | null {
  const lines = chunk.split(/\r?\n/).filter(Boolean)

  if (lines.length === 0) {
    return null
  }

  const event =
    lines
      .find((line) => line.startsWith('event:'))
      ?.slice(6)
      .trim() ?? 'message'
  const dataText = lines
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim())
    .join('\n')

  return {
    event,
    data: dataText ? JSON.parse(dataText) : null
  }
}

function handleAuthFailure() {
  clearStoredToken()
  if (window.location.pathname !== '/login') {
    window.location.href = '/login'
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
  handlers: StreamMessageHandlers
): Promise<{ conversationId: string }> {
  const token = getStoredToken()
  const response = await fetch(`${apiBaseUrl}/conversations/${conversationId}/messages/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(input)
  })

  if (response.status === 401) {
    handleAuthFailure()
    throw new Error('未登录或登录已过期')
  }

  if (!response.ok || !response.body) {
    const text = await response.text()
    throw new Error(text || '流式请求失败')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let latestConversationId = conversationId

  while (true) {
    const { done, value } = await reader.read()

    if (done) {
      buffer += decoder.decode()
      break
    }

    buffer += decoder.decode(value, { stream: true })

    while (true) {
      const boundary = findSseBoundary(buffer)

      if (!boundary) {
        break
      }

      const rawEvent = buffer.slice(0, boundary.index)
      buffer = buffer.slice(boundary.index + boundary.length)

      const parsed = parseSseEvent(rawEvent)

      if (!parsed) {
        continue
      }

      if (parsed.event === 'user-message' && parsed.data) {
        handlers.onUserMessage?.(parsed.data as Message)
      }

      if (parsed.event === 'assistant-delta' && parsed.data) {
        handlers.onAssistantDelta?.((parsed.data as { delta: string }).delta)
      }

      if (parsed.event === 'assistant-done' && parsed.data) {
        const payload = parsed.data as { assistantMessage: Message; conversationId: string }
        latestConversationId = payload.conversationId
        handlers.onAssistantDone?.(payload)
      }

      if (parsed.event === 'error' && parsed.data) {
        const payload = parsed.data as { message?: string }
        throw new Error(payload.message || '流式请求失败')
      }
    }
  }

  const remainingEvent = parseSseEvent(buffer.trim())

  if (remainingEvent?.event === 'error' && remainingEvent.data) {
    const payload = remainingEvent.data as { message?: string }
    throw new Error(payload.message || '流式请求失败')
  }

  if (remainingEvent?.event === 'assistant-done' && remainingEvent.data) {
    const payload = remainingEvent.data as { assistantMessage: Message; conversationId: string }
    latestConversationId = payload.conversationId
    handlers.onAssistantDone?.(payload)
  }

  return { conversationId: latestConversationId }
}
