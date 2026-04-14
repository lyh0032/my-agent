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
import dayjs from 'dayjs'

type ConversationMessage = {
  role: 'user' | 'assistant' | 'system'
  content: string
}

type GenerateAssistantReplyParams = {
  latestUserMessage: string
  memoryContext: string[]
  conversationHistory: ConversationMessage[]
  onStatusChange?: (payload: { stage: 'thinking' | 'tool' | 'reasoning'; text: string }) => void
  modelOverride?: string
}

type ChatModelWithTools = ReturnType<ChatOpenAI['bindTools']>
type ToolCallLike = NonNullable<AIMessage['tool_calls']>[number]

const MAX_TOOL_CALL_ROUNDS = 5
const toolsByName = new Map(tools.map((tool) => [tool.name, tool]))

function isAsyncIterable(value: unknown): value is AsyncIterable<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    Symbol.asyncIterator in value &&
    typeof value[Symbol.asyncIterator] === 'function'
  )
}

async function getChatModel(modelOverride?: string): Promise<ChatModelWithTools> {
  if (!env.LLM_API_KEY) {
    throw new AppError(500, '阿里云百炼 API 未配置', 'MODEL_CONFIG_MISSING')
  }

  const modelName = modelOverride || env.LLM_MODEL

  const baseModel = new ChatOpenAI({
    apiKey: env.LLM_API_KEY,
    model: modelName,
    configuration: env.LLM_BASE_URL ? { baseURL: env.LLM_BASE_URL } : undefined
  })

  return baseModel.bindTools(tools, {
    parallel_tool_calls: false,
    strict: true
  })
}

function buildLangChainMessages({
  latestUserMessage,
  memoryContext,
  conversationHistory
}: GenerateAssistantReplyParams) {
  const systemPrompt = [
    '你是一个中文优先的 AI 助手。',
    '回答要直接、清晰、尽量有可执行性。',
    '工具使用规则：',
    '1. 只要用户询问实时新闻、最新动态、今天/最近发生了什么、当前价格、近期赛事结果等强时效性信息，必须先调用 webSearchTool。',
    '2. 工具返回后，要基于工具结果继续回答，不要忽略工具输出。',
    '3. webSearchTool 返回的是检索原始结果，你需要自行提炼时间、事实、结论并组织成最终回答，不要把工具输出原样当成最终答案。',
    '4. 调用工具时必须提供完整且有效的参数。调用 webSearchTool 时，query 必须是非空字符串，不能传空对象。',
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

async function stringifyToolResult(result: unknown): Promise<string> {
  if (isAsyncIterable(result)) {
    let aggregated = ''

    for await (const chunk of result) {
      aggregated += normalizeContent(chunk)
    }

    return aggregated.trim()
  }

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

function parseRawToolCalls(rawToolCalls: unknown): ToolCallLike[] {
  if (!Array.isArray(rawToolCalls)) {
    return []
  }

  return rawToolCalls.flatMap((rawToolCall) => {
    if (!rawToolCall || typeof rawToolCall !== 'object' || !('function' in rawToolCall)) {
      return []
    }

    const toolCallFunction = rawToolCall.function

    if (!toolCallFunction || typeof toolCallFunction !== 'object') {
      return []
    }

    const name =
      'name' in toolCallFunction && typeof toolCallFunction.name === 'string'
        ? toolCallFunction.name
        : ''
    const rawArgs =
      'arguments' in toolCallFunction && typeof toolCallFunction.arguments === 'string'
        ? toolCallFunction.arguments
        : ''
    const id =
      'id' in rawToolCall && typeof rawToolCall.id === 'string' ? rawToolCall.id : undefined

    try {
      const args = JSON.parse(rawArgs)

      if (!args || typeof args !== 'object' || Array.isArray(args)) {
        return []
      }

      return [
        {
          name,
          args,
          id,
          type: 'tool_call'
        }
      ]
    } catch {
      return []
    }
  })
}

function isValidToolCall(toolCall: ToolCallLike): boolean {
  return (
    typeof toolCall.name === 'string' &&
    toolCall.name.trim().length > 0 &&
    typeof toolCall.id === 'string' &&
    toolCall.id.trim().length > 0 &&
    !!toolCall.args &&
    typeof toolCall.args === 'object' &&
    !Array.isArray(toolCall.args)
  )
}

function getCompleteToolCalls(toolCalls: ToolCallLike[]): ToolCallLike[] {
  return toolCalls.filter(isValidToolCall)
}

function hasToolCallSignals(
  message: Pick<AIMessageChunk, 'tool_calls' | 'tool_call_chunks' | 'additional_kwargs'>
): boolean {
  const rawToolCalls = (message.additional_kwargs as { tool_calls?: unknown } | undefined)
    ?.tool_calls

  return Boolean(
    message.tool_calls?.length ||
    message.tool_call_chunks?.length ||
    (Array.isArray(rawToolCalls) && rawToolCalls.length)
  )
}

function extractToolCalls(
  message: Pick<AIMessageChunk, 'tool_calls' | 'tool_call_chunks' | 'additional_kwargs'>
): ToolCallLike[] {
  const directToolCalls = getCompleteToolCalls(message.tool_calls ?? [])

  if (directToolCalls.length) {
    return directToolCalls
  }

  if (message.tool_call_chunks?.length) {
    const reparsedChunk = new AIMessageChunk({
      content: '',
      tool_call_chunks: message.tool_call_chunks
    })

    const chunkToolCalls = getCompleteToolCalls(reparsedChunk.tool_calls ?? [])

    if (chunkToolCalls.length) {
      return chunkToolCalls
    }
  }

  const rawToolCalls = parseRawToolCalls(
    (message.additional_kwargs as { tool_calls?: unknown } | undefined)?.tool_calls
  )

  const completeRawToolCalls = getCompleteToolCalls(rawToolCalls)

  if (completeRawToolCalls.length) {
    return completeRawToolCalls
  }

  if (hasToolCallSignals(message)) {
    console.log(
      '[tool-call] 检测到未完成的工具调用片段，暂不执行，等待后续聚合',
      dayjs().format('HH:mm:ss')
    )
  }

  return []
}

function formatToolCallNames(toolCalls: ToolCallLike[]): string {
  return toolCalls.map((toolCall) => toolCall.name || 'unknown').join(', ')
}

function getToolStatusText(toolCalls: ToolCallLike[]): string {
  if (toolCalls.some((toolCall) => toolCall.name === 'webSearchTool')) {
    return '正在联网检索相关信息...'
  }

  return '正在调用工具处理问题...'
}

function getReasoningStatusText(toolCalls: ToolCallLike[]): string {
  if (toolCalls.some((toolCall) => toolCall.name === 'webSearchTool')) {
    return '检索完成，正在整理答案...'
  }

  return '工具执行完成，正在整理答案...'
}

function getToolArgsValidationError(
  toolName: string,
  toolArgs: Record<string, unknown>
): string | null {
  const currentTool = toolsByName.get(toolName)
  const schema = (
    currentTool as { schema?: { safeParse?: (input: unknown) => unknown } } | undefined
  )?.schema

  if (!schema || typeof schema.safeParse !== 'function') {
    return null
  }

  const result = schema.safeParse(toolArgs) as
    | { success: true }
    | { success: false; error: { issues: Array<{ message?: string }> } }

  if (result.success) {
    return null
  }

  return result.error.issues[0]?.message ?? '工具参数校验失败'
}

async function executeToolCalls(
  toolCalls: AIMessage['tool_calls'],
  context: {
    source: 'stream' | 'resolve'
    round: number
    onStatusChange?: (payload: { stage: 'thinking' | 'tool' | 'reasoning'; text: string }) => void
  },
  type: string
): Promise<ToolMessage[]> {
  const normalizedToolCalls = toolCalls ?? []

  console.log(
    `[${context.source}] 第 ${context.round + 1} 轮工具调用---${type}，数量=${normalizedToolCalls.length}，工具=${formatToolCallNames(normalizedToolCalls)}`,
    dayjs().format('HH:mm:ss')
  )

  context.onStatusChange?.({
    stage: 'tool',
    text: getToolStatusText(normalizedToolCalls)
  })

  const toolMessages = await Promise.all(
    normalizedToolCalls.map(async (toolCall, index) => {
      const currentTool = toolsByName.get(toolCall.name)

      if (!currentTool) {
        throw new AppError(500, `未找到工具：${toolCall.name}`, 'MODEL_TOOL_NOT_FOUND')
      }

      if (!toolCall.id) {
        throw new AppError(502, '模型返回的工具调用缺少 id', 'MODEL_TOOL_CALL_INVALID')
      }

      try {
        const validationError = getToolArgsValidationError(
          toolCall.name,
          (toolCall.args ?? {}) as Record<string, unknown>
        )

        if (validationError) {
          console.log(
            `[${context.source}] 跳过无效工具参数 ${index + 1}/${normalizedToolCalls.length}: ${toolCall.name}`,
            dayjs().format('HH:mm:ss'),
            toolCall.args
          )

          return new ToolMessage({
            tool_call_id: toolCall.id,
            content: `工具参数校验失败：${validationError}。请重新生成完整参数后再调用该工具。`,
            status: 'error'
          })
        }

        console.log(
          `[${context.source}] 开始执行工具 ${index + 1}/${normalizedToolCalls.length}: ${toolCall.name}`,
          dayjs().format('HH:mm:ss'),
          toolCall.args
        )
        const result = await currentTool.invoke(toolCall.args ?? {})
        const content = await stringifyToolResult(result)
        console.log(
          `[${context.source}] 工具执行完成 ${index + 1}/${normalizedToolCalls.length}: ${toolCall.name}`,
          dayjs().format('HH:mm:ss')
        )

        return new ToolMessage({
          tool_call_id: toolCall.id,
          content,
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

  context.onStatusChange?.({
    stage: 'reasoning',
    text: getReasoningStatusText(normalizedToolCalls)
  })

  return toolMessages
}

async function resolveMessagesForStreaming(
  model: ChatModelWithTools,
  messages: BaseMessage[],
  onStatusChange?: (payload: { stage: 'thinking' | 'tool' | 'reasoning'; text: string }) => void
) {
  const currentMessages: BaseMessage[] = [...messages]

  for (let round = 0; round < MAX_TOOL_CALL_ROUNDS; round += 1) {
    const result = await model.invoke(currentMessages)
    const toolCalls = extractToolCalls(result)

    if (!toolCalls.length) {
      return currentMessages
    }

    currentMessages.push(result)

    const toolMessages = await executeToolCalls(
      toolCalls,
      {
        source: 'resolve',
        round,
        onStatusChange
      },
      'resolveMessagesForStreaming'
    )
    currentMessages.push(...toolMessages)
  }

  throw new AppError(502, '模型工具调用次数过多', 'MODEL_TOOL_CALL_LIMIT')
}

async function* streamAssistantReplyWithTools(
  model: ChatModelWithTools,
  messages: BaseMessage[],
  onStatusChange?: (payload: { stage: 'thinking' | 'tool' | 'reasoning'; text: string }) => void
): AsyncGenerator<string, AIMessageChunk, void> {
  const currentMessages: BaseMessage[] = [...messages]

  for (let round = 0; round < MAX_TOOL_CALL_ROUNDS; round += 1) {
    const stream = await model.stream(currentMessages)
    let fullChunk: AIMessageChunk | null = null
    let emittedTextInRound = false

    for await (const chunk of stream) {
      fullChunk = fullChunk ? fullChunk.concat(chunk) : chunk

      const delta = normalizeContent(chunk.content)

      if (!delta) {
        continue
      }

      emittedTextInRound = true
      yield delta
    }

    if (!fullChunk) {
      throw new AppError(502, '模型流式响应为空', 'MODEL_EMPTY_STREAM')
    }

    const toolCalls = extractToolCalls(fullChunk)

    if (!toolCalls.length) {
      if (!emittedTextInRound && hasToolCallSignals(fullChunk)) {
        console.log(
          `[stream] 流式工具调用片段不完整，改用 invoke 补全工具调用，第 ${round + 1} 轮`,
          dayjs().format('HH:mm:ss')
        )

        const resolvedResult = await model.invoke(currentMessages)
        const resolvedToolCalls = extractToolCalls(resolvedResult)

        if (resolvedToolCalls.length) {
          currentMessages.push(resolvedResult)

          const toolMessages = await executeToolCalls(
            resolvedToolCalls,
            {
              source: 'stream',
              round,
              onStatusChange
            },
            'streamAssistantReplyWithTools:invoke-resolution'
          )
          currentMessages.push(...toolMessages)
          continue
        }
      }

      return fullChunk
    }

    currentMessages.push(fullChunk)

    console.log(`[stream] 流式响应识别到工具调用，第 ${round + 1} 轮`, dayjs().format('HH:mm:ss'))
    const toolMessages = await executeToolCalls(
      toolCalls,
      {
        source: 'stream',
        round,
        onStatusChange
      },
      'streamAssistantReplyWithTools'
    )
    currentMessages.push(...toolMessages)
  }

  throw new AppError(502, '模型工具调用次数过多', 'MODEL_TOOL_CALL_LIMIT')
}

export async function* streamAssistantReply({
  latestUserMessage,
  memoryContext,
  conversationHistory,
  onStatusChange,
  modelOverride
}: GenerateAssistantReplyParams): AsyncGenerator<string, string, void> {
  const model = await getChatModel(modelOverride)
  const messages = buildLangChainMessages({
    latestUserMessage,
    memoryContext,
    conversationHistory
  })

  let fullText = ''

  console.log('进入流 streamAssistantReply', dayjs().format('HH:mm:ss'))
  onStatusChange?.({
    stage: 'thinking',
    text: '正在思考问题...'
  })

  try {
    for await (const delta of streamAssistantReplyWithTools(model, messages, onStatusChange)) {
      fullText += delta
      yield delta
    }

    if (!fullText.trim()) {
      console.log(
        '[resolve] 流式阶段未产出文本，进入 fallback tool-resolution + stream',
        dayjs().format('HH:mm:ss')
      )
      const resolvedMessages = await resolveMessagesForStreaming(model, messages, onStatusChange)

      const fallbackStream = await model.stream(resolvedMessages)

      for await (const chunk of fallbackStream) {
        const delta = normalizeContent(chunk.content)

        if (!delta) {
          continue
        }

        fullText += delta
        yield delta
      }

      if (!fullText.trim()) {
        const fallbackResult = await model.invoke(resolvedMessages)
        const fallbackContent = normalizeContent(fallbackResult.content)

        if (fallbackContent) {
          fullText = fallbackContent
          yield fallbackContent
        }
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
