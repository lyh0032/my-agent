import { Router } from 'express'

import { authMiddleware } from '../../middlewares/auth'
import { validate } from '../../middlewares/validate'
import { asyncHandler } from '../../utils/async-handler'
import {
  cancelMessageStreamController,
  createMessageController,
  listMessagesController,
  subscribeMessageStreamController,
  streamMessageController
} from './message.controller'
import {
  createMessageBodySchema,
  messageParamsSchema,
  messageStreamParamsSchema
} from './message.schema'

const router = Router({ mergeParams: true })

router.use(authMiddleware)
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

export { router as messageRouter }
