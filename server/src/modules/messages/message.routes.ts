import { Router } from 'express'
import multer from 'multer'

import { authMiddleware } from '../../middlewares/auth'
import { validate } from '../../middlewares/validate'
import { asyncHandler } from '../../utils/async-handler'
import {
  cancelMessageStreamController,
  createMessageController,
  deleteMessageController,
  listMessagesController,
  regenerateMessageController,
  subscribeMessageStreamController,
  transcribeAudioController,
  streamMessageController,
  updateMessageController
} from './message.controller'
import {
  createMessageBodySchema,
  deleteMessageParamsSchema,
  messageParamsSchema,
  messageStreamParamsSchema,
  regenerateMessageParamsSchema,
  updateMessageBodySchema,
  updateMessageParamsSchema
} from './message.schema'

const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
})

const router = Router({ mergeParams: true })

router.use(authMiddleware)
router.post(
  '/audio/transcribe',
  audioUpload.single('audio'),
  asyncHandler(transcribeAudioController)
)
router.get('/', validate({ params: messageParamsSchema }), asyncHandler(listMessagesController))
router.post(
  '/stream',
  validate({ params: messageParamsSchema, body: createMessageBodySchema }),
  asyncHandler(streamMessageController)
)
router.get(
  '/:messageId/stream',
  validate({ params: messageStreamParamsSchema }),
  asyncHandler(subscribeMessageStreamController)
)
router.post(
  '/:messageId/cancel',
  validate({ params: messageStreamParamsSchema }),
  asyncHandler(cancelMessageStreamController)
)
router.post(
  '/',
  validate({ params: messageParamsSchema, body: createMessageBodySchema }),
  asyncHandler(createMessageController)
)
router.patch(
  '/:messageId',
  validate({ params: updateMessageParamsSchema, body: updateMessageBodySchema }),
  asyncHandler(updateMessageController)
)
router.delete(
  '/:messageId',
  validate({ params: deleteMessageParamsSchema }),
  asyncHandler(deleteMessageController)
)
router.post(
  '/:messageId/regenerate',
  validate({ params: regenerateMessageParamsSchema }),
  asyncHandler(regenerateMessageController)
)

export { router as messageRouter }
