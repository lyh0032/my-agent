import { env } from '../config/env'
import { AppError } from '../utils/app-error'

export async function transcribeAudio(audioBuffer: Buffer, mimeType: string): Promise<string> {
  if (!env.LLM_API_KEY) {
    throw new AppError(500, 'LLM API 未配置', 'MODEL_CONFIG_MISSING')
  }

  const base64Audio = audioBuffer.toString('base64')
  const dataUri = `data:${mimeType};base64,${base64Audio}`

  const baseURL = env.LLM_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1'

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
          enable_itn: false
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

  const json = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>
  }

  const text = json.choices?.[0]?.message?.content?.trim() ?? ''

  if (!text) {
    throw new AppError(502, '语音识别返回为空', 'AUDIO_TRANSCRIBE_EMPTY')
  }

  return text
}
