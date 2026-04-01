import { Router } from 'express'

import { authMiddleware } from '../../middlewares/auth'
import { validate } from '../../middlewares/validate'
import { asyncHandler } from '../../utils/async-handler'
import {
  createConversationController,
  deleteConversationController,
  getConversationDetailController,
  listConversationsController,
  updateConversationController
} from './conversation.controller'
import {
  conversationParamsSchema,
  createConversationBodySchema,
  updateConversationBodySchema
} from './conversation.schema'

const router = Router()

router.use(authMiddleware)
router.get('/', asyncHandler(listConversationsController))
router.post(
  '/',
  validate({ body: createConversationBodySchema }),
  asyncHandler(createConversationController)
)
router.get(
  '/:conversationId',
  validate({ params: conversationParamsSchema }),
  asyncHandler(getConversationDetailController)
)
router.patch(
  '/:conversationId',
  validate({ params: conversationParamsSchema, body: updateConversationBodySchema }),
  asyncHandler(updateConversationController)
)
router.delete(
  '/:conversationId',
  validate({ params: conversationParamsSchema }),
  asyncHandler(deleteConversationController)
)

export { router as conversationRouter }
