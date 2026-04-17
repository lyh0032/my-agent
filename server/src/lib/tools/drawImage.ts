import { tool } from '@langchain/core/tools'
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { randomUUID } from 'node:crypto'

import { env } from '../../config/env'
import z from 'zod'

type DashScopeImageResponse = {
  request_id?: string
  code?: string
  message?: string
  output?: {
    choices?: Array<{
      message?: {
        content?: Array<{
          image?: string
        }>
      }
    }>
  }
}

type UploadedImage = {
  objectKey: string
  publicUrl?: string
}

const DEFAULT_STORAGE_REGION = 'us-east-1'
const STORAGE_FORCE_PATH_STYLE = true
const STORAGE_MAX_ATTEMPTS = 1
const DEFAULT_NEGATIVE_PROMPT =
  '低分辨率，低画质，肢体畸形，手指畸形，构图混乱，文字模糊，扭曲，过度平滑，强烈 AI 感。'

const drawImageToolInputSchema = z
  .object({
    prompt: z
      .string()
      .trim()
      .min(1)
      .max(800)
      .optional()
      .describe('图片生成提示词，描述你想要生成的画面内容。'),
    query: z.string().trim().min(1).max(800).optional().describe('兼容旧参数，等价于 prompt。'),
    negativePrompt: z
      .string()
      .trim()
      .max(500)
      .optional()
      .describe('可选的反向提示词，用来描述不希望在图像中出现的内容。'),
    size: z
      .string()
      .regex(/^\d+\*\d+$/, 'size 必须是 宽*高 格式，例如 1024*1024')
      .optional()
      .describe('可选的输出尺寸，格式为 宽*高，例如 1024*1024。')
  })
  .refine((input) => Boolean(input.prompt || input.query), {
    message: 'prompt 或 query 至少需要提供一个字段。'
  })

function ensureImageApiKey() {
  if (!env.IMAGE_API_KEY) {
    throw new Error(
      '未配置 DASHSCOPE_IMAGE_API_KEY 或 DASHSCOPE_API_KEY，无法调用阿里云文生图接口。'
    )
  }

  return env.IMAGE_API_KEY
}

function buildDashScopeImageEndpoint() {
  return new URL(
    '/api/v1/services/aigc/multimodal-generation/generation',
    env.DASHSCOPE_IMAGE_BASE_URL
  ).toString()
}

function sanitizeAltText(text: string) {
  return (
    text
      .replace(/[\r\n\[\]\(\)]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 60) || '生成图片'
  )
}

function createObjectKey(prompt: string, contentType: string, sourceUrl: string) {
  const date = new Date()
  const datePath = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('/')
  const promptSlug =
    prompt
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\p{L}\p{N}-]/gu, '')
      .slice(0, 32) || 'image'

  const urlPath = new URL(sourceUrl).pathname
  const urlExtension = urlPath.includes('.') ? urlPath.split('.').pop()?.split('?')[0] : ''
  const contentTypeExtension = contentType === 'image/jpeg' ? 'jpg' : contentType.split('/')[1]
  const extension =
    (urlExtension || contentTypeExtension || 'png').replace(/[^a-zA-Z0-9]/g, '') || 'png'
  const prefix = env.STORAGE_PREFIX.replace(/^\/+|\/+$/g, '')

  return `${prefix}/${datePath}/${promptSlug}-${randomUUID()}.${extension}`
}

function buildPublicUrl(objectKey: string) {
  const encodedKey = objectKey
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')

  if (env.STORAGE_PUBLIC_BASE_URL) {
    return `${env.STORAGE_PUBLIC_BASE_URL.replace(/\/$/, '')}/${encodedKey}`
  }

  if (!env.STORAGE_ENDPOINT || !env.STORAGE_BUCKET) {
    return undefined
  }

  return `${env.STORAGE_ENDPOINT.replace(/\/$/, '')}/${encodeURIComponent(env.STORAGE_BUCKET)}/${encodedKey}`
}

function canUploadToS3() {
  return Boolean(
    env.STORAGE_ENDPOINT &&
    env.STORAGE_BUCKET &&
    env.STORAGE_ACCESS_KEY_ID &&
    env.STORAGE_SECRET_ACCESS_KEY
  )
}

function createS3Client() {
  if (!canUploadToS3()) {
    return null
  }

  return new S3Client({
    endpoint: env.STORAGE_ENDPOINT,
    region: DEFAULT_STORAGE_REGION,
    forcePathStyle: STORAGE_FORCE_PATH_STYLE,
    maxAttempts: STORAGE_MAX_ATTEMPTS,
    credentials: {
      accessKeyId: env.STORAGE_ACCESS_KEY_ID!,
      secretAccessKey: env.STORAGE_SECRET_ACCESS_KEY!
    }
  })
}

function createTimeoutAbortController(timeoutMs: number) {
  const abortController = new AbortController()
  const timer = setTimeout(() => {
    abortController.abort(new Error(`操作超时（${timeoutMs}ms）`))
  }, timeoutMs)

  return {
    signal: abortController.signal,
    cleanup() {
      clearTimeout(timer)
    }
  }
}

async function parseJsonResponse<T>(response: Response): Promise<T | null> {
  const text = await response.text()

  if (!text) {
    return null
  }

  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error(text)
  }
}

async function callQwenImageApi(input: { prompt: string; negativePrompt?: string; size: string }) {
  const response = await fetch(buildDashScopeImageEndpoint(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ensureImageApiKey()}`
    },
    body: JSON.stringify({
      model: env.DASHSCOPE_IMAGE_MODEL,
      input: {
        messages: [
          {
            role: 'user',
            content: [{ text: input.prompt }]
          }
        ]
      },
      parameters: {
        size: input.size,
        prompt_extend: env.DASHSCOPE_IMAGE_PROMPT_EXTEND,
        watermark: env.DASHSCOPE_IMAGE_WATERMARK,
        negative_prompt: input.negativePrompt || DEFAULT_NEGATIVE_PROMPT
      }
    })
  })

  const payload = await parseJsonResponse<DashScopeImageResponse>(response)

  if (!response.ok || payload?.code) {
    throw new Error(payload?.message || payload?.code || '阿里云文生图接口调用失败')
  }

  const imageUrl = payload?.output?.choices?.[0]?.message?.content?.find(
    (item) => item.image
  )?.image

  if (!imageUrl) {
    throw new Error('阿里云文生图接口未返回图片地址')
  }

  return {
    imageUrl,
    requestId: payload?.request_id || ''
  }
}

async function uploadImageToS3(sourceUrl: string, prompt: string): Promise<UploadedImage | null> {
  const s3Client = createS3Client()

  if (!s3Client) {
    console.log('s3Client为空')
    return null
  }

  const downloadTimeout = createTimeoutAbortController(env.STORAGE_DOWNLOAD_TIMEOUT_MS)
  let imageResponse: Response

  try {
    imageResponse = await fetch(sourceUrl, {
      signal: downloadTimeout.signal
    })
  } finally {
    downloadTimeout.cleanup()
  }

  if (!imageResponse.ok) {
    console.log('下载阿里云临时图片失败，无法上传到 S3 存储')
    throw new Error('下载阿里云临时图片失败，无法上传到 S3 存储')
  }

  const contentType = imageResponse.headers.get('content-type') || 'image/png'
  const imageBuffer = Buffer.from(await imageResponse.arrayBuffer())
  const objectKey = createObjectKey(prompt, contentType, sourceUrl)

  const params = {
    Bucket: env.STORAGE_BUCKET,
    Key: objectKey,
    Body: imageBuffer,
    ContentType: contentType
  }
  console.log('S3-1.5', params)
  const uploadTimeout = createTimeoutAbortController(env.STORAGE_UPLOAD_TIMEOUT_MS)

  try {
    await s3Client.send(new PutObjectCommand(params), {
      abortSignal: uploadTimeout.signal
    })
  } finally {
    uploadTimeout.cleanup()
  }

  return {
    objectKey,
    publicUrl: buildPublicUrl(objectKey)
  }
}

function buildToolResponse(params: {
  prompt: string
  size: string
  requestId: string
  displayUrl: string
  storageNote: string
  objectKey?: string
}) {
  const altText = sanitizeAltText(params.prompt)
  const lines = [
    '图片生成成功。',
    params.storageNote,
    `![${altText}](${params.displayUrl})`,
    `[下载图片](${params.displayUrl})`,
    `附加信息：模型=${env.DASHSCOPE_IMAGE_MODEL}；尺寸=${params.size}；request_id=${params.requestId || 'unknown'}${params.objectKey ? `；object_key=${params.objectKey}` : ''}`
  ]

  return lines.join('\n')
}

export const drawImageTool = tool(
  async (input) => {
    const { prompt, query, negativePrompt, size } = drawImageToolInputSchema.parse(input)
    const resolvedPrompt = prompt || query

    if (!resolvedPrompt) {
      throw new Error('缺少图片生成提示词')
    }

    try {
      const resolvedSize = size || env.DASHSCOPE_IMAGE_SIZE
      const generated = await callQwenImageApi({
        prompt: resolvedPrompt,
        negativePrompt,
        size: resolvedSize
      })
      console.log('S3-1', generated.imageUrl, resolvedPrompt)
      const uploaded = await uploadImageToS3(generated.imageUrl, resolvedPrompt).catch((error) => {
        console.error('对象存储上传失败，回退临时图片地址:', error)
        return null
      })
      console.log('S3-2', uploaded)
      const displayUrl = uploaded?.publicUrl || generated.imageUrl
      const storageNote = uploaded
        ? uploaded.publicUrl
          ? '图片已上传到 S3 兼容存储，并生成了可直接访问的地址。'
          : '图片已上传到 S3 兼容存储，但未配置 STORAGE_PUBLIC_BASE_URL，当前先回退为阿里云临时地址预览。'
        : '对象存储未配置或上传超时，当前先使用阿里云返回的 24 小时临时地址预览。'

      return buildToolResponse({
        prompt: resolvedPrompt,
        size: resolvedSize,
        requestId: generated.requestId,
        displayUrl,
        storageNote,
        objectKey: uploaded?.objectKey
      })
    } catch (error) {
      return `图片生成失败: ${error instanceof Error ? error.message : '未知错误'}`
    }
  },
  {
    name: 'drawImageTool',
    description:
      '用于根据用户描述生成图片。当用户要求画图、生成海报、创作图片、做视觉效果图时使用。',
    schema: drawImageToolInputSchema
  }
)
