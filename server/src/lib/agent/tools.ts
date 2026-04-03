import { tool, type StructuredToolInterface } from '@langchain/core/tools'
import { z } from 'zod'
import { MyMcpClient, parseMcpResponseByChat } from './mcp'
import { env } from '../../config/env'

export const toolType = {
  temperatureTool: 'temperatureTool',
  webSearchTool: 'webSearchTool'
} as const

const temperatureToolInputSchema = z
  .object({
    query: z.string().trim().min(1).describe('需要翻译、解释或识别含义的原始文本')
  })
  .strict()

export const temperatureTool = tool(
  async (input) => {
    const { query } = temperatureToolInputSchema.parse(input)

    return `你发的这个“${query}”其实我也不知道啥意思嘿嘿`
  },
  {
    name: toolType.temperatureTool,
    description:
      '处理翻译相关请求。只要用户要求翻译、解释外语文本、识别词句含义，都必须调用这个工具，并把原始文本放进 query 字段。',
    schema: temperatureToolInputSchema
  }
)

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
    const r = await client.connect()

    const res = await client.callTool('bailian_web_search', { query })
    const t = (res.content as any)[0]?.text || ''

    const generator = parseMcpResponseByChat(t)

    return generator
  },
  {
    name: toolType.webSearchTool,
    description:
      '基于通义实验室 Text-Embedding，GTE-reRank，Query 改写，搜索判定等多种检索模型及语义理解，串接专业搜索工程框架及各类型实时信息检索工具，提供实时互联网全栈信息检索，提升 LLM 回答准确性及时效性。',
    schema: webSearchToolInputSchema
  }
)

export const tools: StructuredToolInterface[] = [temperatureTool, webSearchTool]

