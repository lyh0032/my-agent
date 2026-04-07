import { tool, type StructuredToolInterface } from '@langchain/core/tools'
import { z } from 'zod'
import { MyMcpClient, parseMcpResponseByChat } from './mcp'
import { env } from '../../config/env'

export const toolType = {
  webSearchTool: 'webSearchTool'
} as const

const webSearchToolInputSchema = z.object({
  query: z.string().describe('搜索关键词')
})

// 联网查询
export const webSearchTool = tool(
  async (input) => {
    const { query } = webSearchToolInputSchema.parse(input)
    const client = new MyMcpClient(
      'https://dashscope.aliyuncs.com/api/v1/mcps/WebSearch/mcp',
      env.DASHSCOPE_API_KEY!
    )
    await client.connect()

    const res = await client.callTool('bailian_web_search', { query })
    const t = (res.content as any)[0]?.text || ''

    const generator = parseMcpResponseByChat(t)

    return generator
  },
  {
    name: toolType.webSearchTool,
    description:
      '处理实时互联网检索。只要用户在问实时新闻、最新动态、近期事件、当前价格、近况、时效性强的信息，都应该调用这个工具，再基于搜索结果回答。',
    schema: webSearchToolInputSchema
  }
)

export const tools: StructuredToolInterface[] = [webSearchTool]
