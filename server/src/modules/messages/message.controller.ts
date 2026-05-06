import type { Request, Response } from 'express'

import {
  cancelMessageStream,
  createMessage,
  listMessages,
  streamMessage,
  subscribeMessageStream
} from './message.service'
import { transcribeAudio } from '../../lib/audio'
import { sendSuccess } from '../../utils/http'
import { AppError } from '../../utils/app-error'
import { closeSse, setupSseHeaders, writeSseEvent } from '../../utils/sse'

type MessageParams = {
  conversationId: string
}

type MessageStreamParams = {
  conversationId: string
  messageId: string
}

function createConnectionSignal(req: Request, res: Response) {
  const abortController = new AbortController()

  const abort = () => {
    abortController.abort()
  }

  req.on('aborted', abort)
  res.on('close', abort)

  return abortController.signal
}

function safeWriteSseEvent(res: Response, event: string, data: unknown) {
  if (!res.writableEnded) {
    writeSseEvent(res, event, data)
  }
}

function buildStreamHandlers(res: Response) {
  return {
    onUserMessage(payload: unknown) {
      safeWriteSseEvent(res, 'user-message', payload)
    },
    onAssistantMessage(payload: unknown) {
      safeWriteSseEvent(res, 'assistant-message', payload)
    },
    onAssistantStatus(payload: unknown) {
      safeWriteSseEvent(res, 'assistant-status', payload)
    },
    onAssistantDelta(delta: string) {
      safeWriteSseEvent(res, 'assistant-delta', { delta })
    },
    onAssistantDone(payload: unknown) {
      safeWriteSseEvent(res, 'assistant-done', payload)
    },
    onAssistantCancelled(payload: unknown) {
      safeWriteSseEvent(res, 'assistant-cancelled', payload)
    },
    onAssistantFailed(payload: unknown) {
      safeWriteSseEvent(res, 'assistant-failed', payload)
    }
  }
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
  const signal = createConnectionSignal(req, res)

  try {
    await streamMessage(
      req.currentUser!.id,
      req.params.conversationId,
      req.body,
      buildStreamHandlers(res),
      signal
    )

    if (!res.writableEnded) {
      closeSse(res)
    }
  } catch (error) {
    if (signal.aborted || res.writableEnded) {
      return
    }

    const appError =
      error instanceof AppError
        ? error
        : new AppError(500, '流式消息处理失败', 'STREAM_MESSAGE_FAILED')

    safeWriteSseEvent(res, 'error', {
      message: appError.message,
      errorCode: appError.errorCode
    })

    if (!res.writableEnded) {
      closeSse(res)
    }
  }
}

export async function subscribeMessageStreamController(
  req: Request<MessageStreamParams>,
  res: Response
) {
  setupSseHeaders(res)
  const signal = createConnectionSignal(req, res)

  try {
    await subscribeMessageStream(
      req.currentUser!.id,
      req.params.conversationId,
      req.params.messageId,
      buildStreamHandlers(res),
      signal
    )

    if (!res.writableEnded) {
      closeSse(res)
    }
  } catch (error) {
    if (signal.aborted || res.writableEnded) {
      return
    }

    const appError =
      error instanceof AppError
        ? error
        : new AppError(500, '恢复流式消息失败', 'RESUME_STREAM_MESSAGE_FAILED')

    safeWriteSseEvent(res, 'error', {
      message: appError.message,
      errorCode: appError.errorCode
    })

    if (!res.writableEnded) {
      closeSse(res)
    }
  }
}

export async function streamAudioMessageController(req: Request<MessageParams>, res: Response) {
  const file = req.file

  if (!file) {
    throw new AppError(400, '未上传音频文件', 'AUDIO_FILE_MISSING')
  }

  let transcribedText: string

  try {
    transcribedText = await transcribeAudio(file.buffer, file.mimetype)
  } catch (error) {
    throw error instanceof AppError
      ? error
      : new AppError(502, '语音识别失败', 'AUDIO_TRANSCRIBE_FAILED')
  }

  setupSseHeaders(res)
  const signal = createConnectionSignal(req, res)

  try {
    await streamMessage(
      req.currentUser!.id,
      req.params.conversationId,
      { content: transcribedText },
      buildStreamHandlers(res),
      signal
    )

    if (!res.writableEnded) {
      closeSse(res)
    }
  } catch (error) {
    if (signal.aborted || res.writableEnded) {
      return
    }

    const appError =
      error instanceof AppError
        ? error
        : new AppError(500, '流式消息处理失败', 'STREAM_MESSAGE_FAILED')

    safeWriteSseEvent(res, 'error', {
      message: appError.message,
      errorCode: appError.errorCode
    })

    if (!res.writableEnded) {
      closeSse(res)
    }
  }
}

export async function cancelMessageStreamController(
  req: Request<MessageStreamParams>,
  res: Response
) {
  const assistantMessage = await cancelMessageStream(
    req.currentUser!.id,
    req.params.conversationId,
    req.params.messageId
  )

  sendSuccess(
    res,
    {
      assistantMessage,
      conversationId: req.params.conversationId
    },
    '停止生成成功'
  )
}
