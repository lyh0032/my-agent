export type ModelInfo = {
  id: string
  name: string
  description: string
}

export const AVAILABLE_MODELS: ModelInfo[] = [
  {
    id: 'qwen3.5-plus',
    name: 'Qwen 3.5 Plus',
    description: '当前默认模型，适合通用对话场景'
  },
  {
    id: 'qwen-plus',
    name: 'Qwen Plus',
    description: '适合长文本对话场景'
  },
  {
    id: 'qwen3.6-plus',
    name: 'Qwen 3.6 Plus',
    description: '旗舰模型'
  }
]

export function getModelById(id: string): ModelInfo | undefined {
  return AVAILABLE_MODELS.find((model) => model.id === id)
}

export function getDefaultModel(): ModelInfo {
  return AVAILABLE_MODELS[0]
}
