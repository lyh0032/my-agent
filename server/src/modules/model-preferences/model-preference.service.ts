import { prisma } from '../../lib/prisma'
import { AppError } from '../../utils/app-error'
import { AVAILABLE_MODELS, getModelById, getDefaultModel } from '../../lib/models'
import type { UpdateModelPreferenceBody } from './model-preference.schema'

type ModelPreferenceInfo = {
  id: string
  name: string
  description: string
}

export async function getAvailableModels(): Promise<ModelPreferenceInfo[]> {
  return AVAILABLE_MODELS
}

export async function getUserPreferredModel(userId: string): Promise<ModelPreferenceInfo> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { preferredModel: true }
  })

  if (!user) {
    throw new AppError(404, '用户不存在', 'USER_NOT_FOUND')
  }

  if (user.preferredModel) {
    const model = getModelById(user.preferredModel)
    if (model) {
      return model
    }
  }

  return getDefaultModel()
}

export async function updateModelPreference(userId: string, data: UpdateModelPreferenceBody) {
  const model = getModelById(data.modelId)

  if (!model) {
    throw new AppError(400, '不支持的模型', 'MODEL_NOT_SUPPORTED')
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { preferredModel: data.modelId }
  })

  return {
    preferredModel: model
  }
}

export async function getModelNameForLLM(userId: string): Promise<string> {
  const preferredModel = await getUserPreferredModel(userId)
  return preferredModel.id
}
