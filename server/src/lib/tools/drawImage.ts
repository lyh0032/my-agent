// 假设使用阿里云 dashscope SDK 或直接使用 fetch
import { tool } from '@langchain/core/tools'
import { ChatOpenAI } from '@langchain/openai' // 用于优化提示词
import z from 'zod'

// 1. 定义一个优化提示词的函数 (可选，但推荐)
async function optimizePrompt(userQuery: string) {
  const llm = new ChatOpenAI({ modelName: 'gpt-3.5-turbo', temperature: 0.7 })
  const response = await llm.invoke(`
        将以下描述转换为适合 AI 绘画的英文提示词，增加细节描述，风格修饰词，但不要包含任何解释，只返回提示词本身。
        用户输入：${userQuery}
    `)
  return response.content
}

const drawImageToolInputSchema = z.object({
  query: z.string().describe('用户想要生成的图片内容的描述')
})

// 2. 定义 Tool
export const drawImageTool = tool(
  async (input) => {
    const { query } = drawImageToolInputSchema.parse(input)

    try {
      // 步骤 A: 优化提示词
      const optimizedQuery = await optimizePrompt(query)

      const imageUrl = await callAliYunWanXiangAPI({
        prompt: optimizedQuery,
        n: 1,
        size: '1024x1024'
      })

      // 步骤 C: 返回图片 URL 给 LLM
      return `图片生成成功，URL是: ${imageUrl}`
    } catch (error) {
      return `图片生成失败: ${error instanceof Error ? error.message : '未知错误'}`
    }
  },
  {
    name: 'drawImageTool',
    description: '用于根据用户的描述生成图片。当用户要求画图、生成图像、创作图片时使用。',
    schema: drawImageToolInputSchema
  }
)
