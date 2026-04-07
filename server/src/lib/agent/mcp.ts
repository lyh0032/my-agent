import { ChatOpenAI } from '@langchain/openai'
import { HumanMessage } from '@langchain/core/messages'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { env } from '../../config/env'

function normalizeChunkContent(content: unknown): string {
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
      .join('')
  }

  return ''
}

export class MyMcpClient {
  client: Client
  transport: StreamableHTTPClientTransport

  constructor(mcpUrl: string, apiKey: string) {
    this.client = new Client({ name: 'WebSearch', version: '1.0.0' })
    // 初始化传输层，指向你的第三方链接
    this.transport = new StreamableHTTPClientTransport(new URL(mcpUrl), {
      requestInit: {
        headers: {
          Authorization: `Bearer ${apiKey}`
        }
      }
    })
  }

  // 连接并获取工具列表
  async connect() {
    await this.client.connect(this.transport)
    // 获取所有可用工具（例如：搜索、计算器等）
    const tools = await this.client.listTools()
    return tools
  }

  // 调用具体工具
  async callTool(toolName: string, args: Record<string, any>) {
    const result = await this.client.callTool({
      name: toolName,
      arguments: args
    })
    return result
  }
}

export async function* parseMcpResponseByChat(str: string) {
  const model = new ChatOpenAI({
    apiKey: env.DASHSCOPE_API_KEY!,
    model: 'qwen-plus',
    configuration: {
      baseURL: env.DASHSCOPE_BASE_URL
    }
  })

  const stream = await model.stream([
    new HumanMessage(`1、你现在是一个MCP结果解析助手，帮我解析这个MCP工具调用的结果，提取出来有用的信息并且简练
      2、可以返回你认为合适的格式
      3、注意你是直接给用户呈现的，相当于是一个中间件模型解析工具，请直接返回解析后的结果，不要任何多余的说明
      以下是MCP接口返回的内容：
      ${str}`)
  ])

  for await (const chunk of stream) {
    const delta = normalizeChunkContent(chunk.content)

    if (delta) {
      yield delta
    }
  }
}
