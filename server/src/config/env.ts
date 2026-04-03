import dotenv from 'dotenv'
import { z } from 'zod'

dotenv.config()

const nodeEnv = process.env.NODE_ENV ?? 'development'
const isProduction = nodeEnv === 'production'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5172),
  DATABASE_URL: isProduction ? z.string().min(1) : z.string().min(1).default('file:./dev.db'),
  JWT_SECRET: isProduction
    ? z.string().min(8)
    : z.string().min(8).default('dev-jwt-secret-change-me'),
  DASHSCOPE_API_KEY: z.string().optional(),
  DASHSCOPE_BASE_URL: z.string().url().default('https://dashscope.aliyuncs.com/compatible-mode/v1'),
  DASHSCOPE_MODEL: z.string().default('qwen-plus'),
  DASHSCOPE_WEBSEARCH_MCP_URL: z
    .string()
    .url()
    .default('https://dashscope.aliyuncs.com/api/v1/mcps/WebSearch/mcp'),
  DASHSCOPE_WEBSEARCH_ENABLED: z.coerce.boolean().default(true),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_BASE_URL: z.string().url().optional(),
  OPENAI_MODEL: z.string().optional(),
  MCP_SERVERS: z.string().optional()
})

const parsedEnv = envSchema.safeParse(process.env)

if (!parsedEnv.success) {
  console.error('Invalid environment variables', parsedEnv.error.flatten().fieldErrors)
  throw new Error('Invalid environment variables')
}

const resolvedEnv = parsedEnv.data

export const env = {
  ...resolvedEnv,
  LLM_API_KEY: resolvedEnv.DASHSCOPE_API_KEY ?? resolvedEnv.OPENAI_API_KEY ?? '',
  LLM_BASE_URL: resolvedEnv.DASHSCOPE_API_KEY
    ? resolvedEnv.DASHSCOPE_BASE_URL
    : (resolvedEnv.OPENAI_BASE_URL ?? ''),
  LLM_MODEL: resolvedEnv.DASHSCOPE_API_KEY
    ? resolvedEnv.DASHSCOPE_MODEL
    : (resolvedEnv.OPENAI_MODEL ?? resolvedEnv.DASHSCOPE_MODEL)
}
