import { tool, type StructuredToolInterface } from '@langchain/core/tools'
import { z } from 'zod'
import { MyMcpClient, extractMcpToolText } from './mcp'
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
    return extractMcpToolText(res)
  },
  {
    name: toolType.webSearchTool,
    description:
      '处理实时互联网检索。只要用户在问实时新闻、最新动态、近期事件、当前价格、近况、时效性强的信息，都应该调用这个工具。工具会返回检索到的原始文本结果，你需要基于这些结果整理答案，优先提取时间、事实和关键信息。',
    schema: webSearchToolInputSchema
  }
)

export const tools: StructuredToolInterface[] = [webSearchTool]
