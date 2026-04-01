import { prisma } from '../../lib/prisma'
import { AppError } from '../../utils/app-error'
import type { CreateConversationBody, UpdateConversationBody } from './conversation.schema'

function buildConversationTitle(input?: string, title?: string): string {
  if (title?.trim()) {
    return title.trim().slice(0, 120)
  }

  if (input?.trim()) {
    return input.trim().slice(0, 40)
  }

  return '新会话'
}

export async function listConversations(userId: string) {
  const conversations = await prisma.conversation.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    include: {
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { content: true }
      },
      _count: {
        select: { messages: true }
      }
    }
  })

  return conversations.map((conversation) => ({
    id: conversation.id,
    title: conversation.title,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    lastMessagePreview: conversation.messages[0]?.content ?? '',
    messageCount: conversation._count.messages
  }))
}

export async function createConversation(userId: string, data: CreateConversationBody) {
  return prisma.conversation.create({
    data: {
      userId,
      title: buildConversationTitle(data.initialMessage, data.title)
    },
    select: {
      id: true,
      title: true,
      createdAt: true,
      updatedAt: true
    }
  })
}

export async function getConversationDetail(userId: string, conversationId: string) {
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, userId },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' }
      }
    }
  })

  if (!conversation) {
    throw new AppError(404, '会话不存在', 'NOT_FOUND')
  }

  return conversation
}

export async function updateConversation(
  userId: string,
  conversationId: string,
  data: UpdateConversationBody
) {
  await ensureConversationOwnership(userId, conversationId)

  return prisma.conversation.update({
    where: { id: conversationId },
    data: { title: data.title },
    select: {
      id: true,
      title: true,
      createdAt: true,
      updatedAt: true
    }
  })
}

export async function deleteConversation(userId: string, conversationId: string) {
  await ensureConversationOwnership(userId, conversationId)
  await prisma.conversation.delete({ where: { id: conversationId } })
}

export async function ensureConversationOwnership(userId: string, conversationId: string) {
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, userId },
    select: { id: true }
  })

  if (!conversation) {
    throw new AppError(404, '会话不存在', 'NOT_FOUND')
  }

  return conversation
}
