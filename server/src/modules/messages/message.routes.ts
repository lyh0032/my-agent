import { Router } from 'express'

import { authMiddleware } from '../../middlewares/auth'
import { validate } from '../../middlewares/validate'
import { asyncHandler } from '../../utils/async-handler'
import {
  createMessageController,
  listMessagesController,
  streamMessageController
} from './message.controller'
import { createMessageBodySchema, messageParamsSchema } from './message.schema'

const router = Router({ mergeParams: true })

router.use(authMiddleware)
router.get('/', validate({ params: messageParamsSchema }), asyncHandler(listMessagesController))
router.post(
  '/stream',
  validate({ params: messageParamsSchema, body: createMessageBodySchema }),
  asyncHandler(streamMessageController)
)
router.post(
  '/',
  validate({ params: messageParamsSchema, body: createMessageBodySchema }),
  asyncHandler(createMessageController)
)

export { router as messageRouter }
