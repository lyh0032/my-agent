import {
  AIMessage,
  AIMessageChunk,
  HumanMessage,
  SystemMessage,
  ToolMessage,
  type BaseMessage
} from '@langchain/core/messages'
import { ChatOpenAI } from '@langchain/openai'

import { env } from '../config/env'
import { AppError } from '../utils/app-error'
import { tools } from './agent/tools'

type ConversationMessage = {
  role: 'user' | 'assistant' | 'system'
  content: string
}

type GenerateAssistantReplyParams = {
  latestUserMessage: string
  memoryContext: string[]
  conversationHistory: ConversationMessage[]
}

type ChatModelWithTools = ReturnType<ChatOpenAI['bindTools']>

const MAX_TOOL_CALL_ROUNDS = 5
const toolsByName = new Map(tools.map((tool) => [tool.name, tool]))
let chatModelPromise: Promise<ChatModelWithTools> | null = null

async function getChatModel(): Promise<ChatModelWithTools> {
  if (!env.LLM_API_KEY) {
    throw new AppError(500, '阿里云百炼 API 未配置', 'MODEL_CONFIG_MISSING')
  }

  if (!chatModelPromise) {
    chatModelPromise = (async () => {
      const baseModel = new ChatOpenAI({
        apiKey: env.LLM_API_KEY,
        model: env.LLM_MODEL,
        configuration: env.LLM_BASE_URL ? { baseURL: env.LLM_BASE_URL } : undefined
      })

      return baseModel.bindTools(tools)
    })().catch((error) => {
      chatModelPromise = null
      throw error
    })
  }

  return chatModelPromise
}

function buildLangChainMessages({
  latestUserMessage,
  memoryContext,
  conversationHistory
}: GenerateAssistantReplyParams) {
  const systemPrompt = [
    '你是一个中文优先的 AI 助手。',
    '回答要直接、清晰、尽量有可执行性。',
    memoryContext.length > 0 ? `以下是当前用户的长期记忆：\n${memoryContext.join('\n')}` : ''
  ]
    .filter(Boolean)
    .join('\n\n')

  return [
    new SystemMessage(systemPrompt),
    ...conversationHistory.map((message) => {
      if (message.role === 'assistant') {
        return new AIMessage(message.content)
      }

      if (message.role === 'system') {
        return new SystemMessage(message.content)
      }

      return new HumanMessage(message.content)
    }),
    new HumanMessage(latestUserMessage)
  ]
}

function normalizeContent(content: unknown): string {
  if (typeof content === 'string') {
    return content
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === 'string') {
          return item
        }

        if (item && typeof item === 'object' && 'text' in item && typeof item.text === 'string') {
          return item.text
        }

        return ''
      })
      .join('\n')
      .trim()
  }

  return ''
}

function stringifyToolResult(result: unknown): string {
  if (typeof result === 'string') {
    return result
  }

  if (result == null) {
    return ''
  }

  try {
    return JSON.stringify(result)
  } catch {
    return String(result)
  }
}

async function executeToolCalls(toolCalls: AIMessage['tool_calls']): Promise<ToolMessage[]> {
  return Promise.all(
    (toolCalls ?? []).map(async (toolCall) => {
      const currentTool = toolsByName.get(toolCall.name)

      if (!currentTool) {
        throw new AppError(500, `未找到工具：${toolCall.name}`, 'MODEL_TOOL_NOT_FOUND')
      }

      if (!toolCall.id) {
        throw new AppError(502, '模型返回的工具调用缺少 id', 'MODEL_TOOL_CALL_INVALID')
      }

      try {
        const result = await currentTool.invoke(toolCall.args ?? {})

        return new ToolMessage({
          tool_call_id: toolCall.id,
          content: stringifyToolResult(result),
          status: 'success'
        })
      } catch (error) {
        return new ToolMessage({
          tool_call_id: toolCall.id,
          content: error instanceof Error ? error.message : '工具执行失败',
          status: 'error'
        })
      }
    })
  )
}

async function resolveMessagesForStreaming(model: ChatModelWithTools, messages: BaseMessage[]) {
  const currentMessages: BaseMessage[] = [...messages]

  for (let round = 0; round < MAX_TOOL_CALL_ROUNDS; round += 1) {
    const result = await model.invoke(currentMessages)

    if (!result.tool_calls?.length) {
      return currentMessages
    }

    currentMessages.push(result)

    const toolMessages = await executeToolCalls(result.tool_calls)
    currentMessages.push(...toolMessages)
  }

  throw new AppError(502, '模型工具调用次数过多', 'MODEL_TOOL_CALL_LIMIT')
}

async function* streamAssistantReplyWithTools(
  model: ChatModelWithTools,
  messages: BaseMessage[]
): AsyncGenerator<string, AIMessageChunk, void> {
  const currentMessages: BaseMessage[] = [...messages]

  for (let round = 0; round < MAX_TOOL_CALL_ROUNDS; round += 1) {
    const stream = await model.stream(currentMessages)
    let fullChunk: AIMessageChunk | null = null

    for await (const chunk of stream) {
      fullChunk = fullChunk ? fullChunk.concat(chunk) : chunk

      const delta = normalizeContent(chunk.content)

      if (!delta) {
        continue
      }

      yield delta
    }

    if (!fullChunk) {
      throw new AppError(502, '模型流式响应为空', 'MODEL_EMPTY_STREAM')
    }

    if (!fullChunk.tool_calls?.length) {
      return fullChunk
    }

    currentMessages.push(fullChunk)

    const toolMessages = await executeToolCalls(fullChunk.tool_calls)
    currentMessages.push(...toolMessages)
  }

  throw new AppError(502, '模型工具调用次数过多', 'MODEL_TOOL_CALL_LIMIT')
}

export async function* streamAssistantReply({
  latestUserMessage,
  memoryContext,
  conversationHistory
}: GenerateAssistantReplyParams): AsyncGenerator<string, string, void> {
  const model = await getChatModel()
  const messages = buildLangChainMessages({
    latestUserMessage,
    memoryContext,
    conversationHistory
  })

  let fullText = ''

  try {
    for await (const delta of streamAssistantReplyWithTools(model, messages)) {
      fullText += delta
      yield delta
    }

    if (!fullText.trim()) {
      const resolvedMessages = await resolveMessagesForStreaming(model, messages)
      const fallbackResult = await model.invoke(resolvedMessages)
      const fallbackContent = normalizeContent(fallbackResult.content)

      if (fallbackContent) {
        fullText = fallbackContent
        yield fallbackContent
      }
    }
  } catch (error) {
    if (error instanceof AppError) {
      throw error
    }

    throw new AppError(502, '模型流式请求失败', 'MODEL_STREAM_FAILED')
  }

  if (!fullText.trim()) {
    throw new AppError(502, '模型返回了空响应', 'MODEL_EMPTY_RESPONSE')
  }

  return fullText
}

export async function generateAssistantReply(
  params: GenerateAssistantReplyParams
): Promise<string> {
  let fullText = ''

  for await (const delta of streamAssistantReply(params)) {
    fullText += delta
  }

  if (!fullText.trim()) {
    throw new AppError(502, '模型返回了空响应', 'MODEL_EMPTY_RESPONSE')
  }

  return fullText
}
