import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages'
import { ChatOpenAI } from '@langchain/openai'

import { env } from '../config/env'
import { AppError } from '../utils/app-error'

type ConversationMessage = {
  role: 'user' | 'assistant' | 'system'
  content: string
}

type GenerateAssistantReplyParams = {
  latestUserMessage: string
  memoryContext: string[]
  conversationHistory: ConversationMessage[]
}

let chatModel: ChatOpenAI | null = null

function getChatModel(): ChatOpenAI {
  console.log(env)
  if (!env.LLM_API_KEY) {
    throw new AppError(500, '阿里云百炼 API 未配置', 'MODEL_CONFIG_MISSING')
  }

  if (!chatModel) {
    chatModel = new ChatOpenAI({
      apiKey: env.LLM_API_KEY,
      model: env.LLM_MODEL,
      configuration: env.LLM_BASE_URL ? { baseURL: env.LLM_BASE_URL } : undefined
    })
  }

  return chatModel
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

export async function generateAssistantReply({
  latestUserMessage,
  memoryContext,
  conversationHistory
}: GenerateAssistantReplyParams): Promise<string> {
  const model = getChatModel()
  const messages = buildLangChainMessages({
    latestUserMessage,
    memoryContext,
    conversationHistory
  })

  try {
    const result = await model.invoke(messages)
    const content = normalizeContent(result.content)

    if (!content) {
      throw new AppError(502, '模型返回了空响应', 'MODEL_EMPTY_RESPONSE')
    }

    return content
  } catch (error) {
    if (error instanceof AppError) {
      throw error
    }

    throw new AppError(502, '模型请求失败', 'MODEL_REQUEST_FAILED')
  }
}

export async function* streamAssistantReply({
  latestUserMessage,
  memoryContext,
  conversationHistory
}: GenerateAssistantReplyParams): AsyncGenerator<string, string, void> {
  const model = getChatModel()
  const messages = buildLangChainMessages({
    latestUserMessage,
    memoryContext,
    conversationHistory
  })

  let fullText = ''

  try {
    const stream = await model.stream(messages)

    for await (const chunk of stream) {
      const delta = normalizeContent(chunk.content)

      if (!delta) {
        continue
      }

      fullText += delta
      yield delta
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
