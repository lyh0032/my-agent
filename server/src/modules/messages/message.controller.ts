import type { Request, Response } from 'express'

import { createMessage, listMessages, streamMessage } from './message.service'
import { sendSuccess } from '../../utils/http'
import { AppError } from '../../utils/app-error'
import { closeSse, setupSseHeaders, writeSseEvent } from '../../utils/sse'

type MessageParams = {
  conversationId: string
}

export async function listMessagesController(req: Request<MessageParams>, res: Response) {
  const data = await listMessages(req.currentUser!.id, req.params.conversationId)
  sendSuccess(res, data, '获取消息列表成功')
}

export async function createMessageController(req: Request<MessageParams>, res: Response) {
  const data = await createMessage(req.currentUser!.id, req.params.conversationId, req.body)
  sendSuccess(res, data, '发送消息成功', 201)
}

export async function streamMessageController(req: Request<MessageParams>, res: Response) {
  setupSseHeaders(res)

  try {
    await streamMessage(req.currentUser!.id, req.params.conversationId, req.body, {
      onUserMessage(payload) {
        writeSseEvent(res, 'user-message', payload)
      },
      onAssistantStatus(payload) {
        writeSseEvent(res, 'assistant-status', payload)
      },
      onAssistantDelta(delta) {
        writeSseEvent(res, 'assistant-delta', { delta })
      },
      onAssistantDone(payload) {
        writeSseEvent(res, 'assistant-done', payload)
      }
    })

    closeSse(res)
  } catch (error) {
    const appError =
      error instanceof AppError
        ? error
        : new AppError(500, '流式消息处理失败', 'STREAM_MESSAGE_FAILED')

    writeSseEvent(res, 'error', {
      message: appError.message,
      errorCode: appError.errorCode
    })

    closeSse(res)
  }
}
