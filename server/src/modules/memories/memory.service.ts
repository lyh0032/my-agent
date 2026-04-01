import { prisma } from '../../lib/prisma'
import { AppError } from '../../utils/app-error'
import type { CreateMemoryBody, MemoryQuery, UpdateMemoryBody } from './memory.schema'

export async function listMemories(userId: string, query: MemoryQuery) {
  const memories = await prisma.memory.findMany({
    where: {
      userId,
      type: query.type,
      OR: query.search
        ? [{ key: { contains: query.search } }, { content: { contains: query.search } }]
        : undefined
    },
    orderBy: { updatedAt: 'desc' }
  })

  return { memories }
}

export async function createMemory(userId: string, data: CreateMemoryBody) {
  const existingMemory = await prisma.memory.findFirst({
    where: {
      userId,
      key: data.key
    },
    select: { id: true }
  })

  if (existingMemory) {
    throw new AppError(409, '记忆 key 已存在', 'MEMORY_KEY_TAKEN')
  }

  return prisma.memory.create({
    data: {
      userId,
      type: data.type,
      key: data.key,
      content: data.content
    }
  })
}

export async function updateMemory(userId: string, memoryId: string, data: UpdateMemoryBody) {
  await ensureMemoryOwnership(userId, memoryId)

  if (data.key) {
    const duplicatedMemory = await prisma.memory.findFirst({
      where: {
        userId,
        key: data.key,
        NOT: { id: memoryId }
      },
      select: { id: true }
    })

    if (duplicatedMemory) {
      throw new AppError(409, '记忆 key 已存在', 'MEMORY_KEY_TAKEN')
    }
  }

  return prisma.memory.update({
    where: { id: memoryId },
    data
  })
}

export async function deleteMemory(userId: string, memoryId: string) {
  await ensureMemoryOwnership(userId, memoryId)
  await prisma.memory.delete({ where: { id: memoryId } })
}

async function ensureMemoryOwnership(userId: string, memoryId: string) {
  const memory = await prisma.memory.findFirst({
    where: {
      id: memoryId,
      userId
    },
    select: { id: true }
  })

  if (!memory) {
    throw new AppError(404, '记忆不存在', 'NOT_FOUND')
  }

  return memory
}
