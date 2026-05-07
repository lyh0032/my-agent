import { env } from '../config/env'
import { AppError } from '../utils/app-error'

const MIN_AUDIO_BYTES = 2048

function isValidSpeech(text: string): boolean {
  const cleaned = text.replace(/[\s\p{P}]/gu, '')

  if (cleaned.length < 2) {
    return false
  }

  const noisePatterns = [
    /^(啊|呃|嗯|哦|哎|哼|哈|咳|呸|嘶|啧|哟|喂|咯|嘎|嘘|嚓|咚|啪|呵|嚯)$/,
    /^[啊呃嗯哦哎哼哈咳呵]+$/
  ]

  for (const pattern of noisePatterns) {
    if (pattern.test(cleaned)) {
      return false
    }
  }

  return true
}

export async function transcribeAudio(audioBuffer: Buffer, mimeType: string): Promise<string> {
  if (!env.LLM_API_KEY) {
    throw new AppError(500, 'LLM API 未配置', 'MODEL_CONFIG_MISSING')
  }

  if (audioBuffer.length < MIN_AUDIO_BYTES) {
    throw new AppError(400, '未检测到有效语音，请录制清晰的人声后重试', 'AUDIO_TOO_SHORT')
  }

  const base64Audio = audioBuffer.toString('base64')
  const dataUri = `data:${mimeType};base64,${base64Audio}`

  const baseURL = env.LLM_BASE_URL

  const response = await fetch(`${baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.LLM_API_KEY}`
    },
    body: JSON.stringify({
      model: 'qwen3-asr-flash',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'input_audio',
              input_audio: {
                data: dataUri
              }
            }
          ]
        }
      ],
      stream: false,
      extra_body: {
        asr_options: {
          enable_itn: false,
          enable_voice_detection: true
        }
      }
    })
  })

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '')
    throw new AppError(
      502,
      `语音识别 API 请求失败: ${response.status} ${errorBody}`,
      'AUDIO_TRANSCRIBE_FAILED'
    )
  }

  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }

  const text = json.choices?.[0]?.message?.content?.trim() ?? ''

  if (!text) {
    throw new AppError(400, '未检测到有效语音，请录制清晰的人声后重试', 'AUDIO_TRANSCRIBE_EMPTY')
  }

  if (!isValidSpeech(text)) {
    throw new AppError(400, '未检测到有效语音，请录制清晰的人声后重试', 'AUDIO_INVALID_SPEECH')
  }

  return text
}
