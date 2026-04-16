import type { Prisma } from '@prisma/client'

import { prisma } from '../../lib/prisma'
import { AppError } from '../../utils/app-error'
import type {
  CreateConversationBody,
  PinConversationBody,
  UpdateConversationBody
} from './conversation.schema'

const conversationSummarySelect = {
  id: true,
  title: true,
  isPinned: true,
  createdAt: true,
  updatedAt: true
} satisfies Prisma.ConversationSelect

const conversationListOrderBy = [
  { isPinned: 'desc' },
  { updatedAt: 'desc' }
] satisfies Prisma.ConversationOrderByWithRelationInput[]

function buildConversationTitle(title?: string): string {
  if (title?.trim()) {
    return title.trim().slice(0, 120)
  }

  return '新会话'
}

export async function listConversations(userId: string) {
  const conversations = await prisma.conversation.findMany({
    where: { userId },
    orderBy: conversationListOrderBy,
    include: {
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 2,
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
    isPinned: conversation.isPinned,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    lastMessagePreview:
      conversation.messages.find((message) => message.content.trim().length > 0)?.content ?? '',
    messageCount: conversation._count.messages
  }))
}

export async function createConversation(userId: string, data: CreateConversationBody) {
  return prisma.conversation.create({
    data: {
      userId,
      title: buildConversationTitle(data.title)
    },
    select: conversationSummarySelect
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
    select: conversationSummarySelect
  })
}

export async function pinConversation(
  userId: string,
  conversationId: string,
  data: PinConversationBody
) {
  await ensureConversationOwnership(userId, conversationId)

  return prisma.conversation.update({
    where: { id: conversationId },
    data: {
      isPinned: data.isPinned,
      updatedAt: new Date()
    },
    select: conversationSummarySelect
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
