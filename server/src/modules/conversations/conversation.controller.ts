import type { Request, Response } from 'express'

import {
  createConversation,
  deleteConversation,
  getConversationDetail,
  listConversations,
  updateConversation
} from './conversation.service'
import { sendDeleted, sendSuccess } from '../../utils/http'

type ConversationParams = {
  conversationId: string
}

export async function listConversationsController(req: Request, res: Response) {
  const conversations = await listConversations(req.currentUser!.id)
  sendSuccess(res, { conversations }, '获取会话列表成功')
}

export async function createConversationController(req: Request, res: Response) {
  const conversation = await createConversation(req.currentUser!.id, req.body)
  sendSuccess(res, conversation, '创建会话成功', 201)
}

export async function getConversationDetailController(
  req: Request<ConversationParams>,
  res: Response
) {
  const conversation = await getConversationDetail(req.currentUser!.id, req.params.conversationId)
  sendSuccess(res, conversation, '获取会话详情成功')
}

export async function updateConversationController(
  req: Request<ConversationParams>,
  res: Response
) {
  const conversation = await updateConversation(
    req.currentUser!.id,
    req.params.conversationId,
    req.body
  )
  sendSuccess(res, conversation, '更新会话成功')
}

export async function deleteConversationController(
  req: Request<ConversationParams>,
  res: Response
) {
  await deleteConversation(req.currentUser!.id, req.params.conversationId)
  sendDeleted(res, '删除会话成功')
}
