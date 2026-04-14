import { z } from 'zod'

import { AVAILABLE_MODELS } from '../../lib/models'

export const updateModelPreferenceBodySchema = z.object({
  modelId: z.string().min(1, '模型 ID 不能为空')
})

export type UpdateModelPreferenceBody = z.infer<typeof updateModelPreferenceBodySchema>

export function validateModelId(modelId: string): boolean {
  return AVAILABLE_MODELS.some((m) => m.id === modelId)
}
