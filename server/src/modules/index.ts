import { Router } from 'express'

import { authRouter } from './auth/auth.routes'
import { conversationRouter } from './conversations/conversation.routes'
import { messageRouter } from './messages/message.routes'
import { memoryRouter } from './memories/memory.routes'

const apiRouter = Router()

apiRouter.use('/auth', authRouter)
apiRouter.use('/conversations', conversationRouter)
apiRouter.use('/conversations/:conversationId/messages', messageRouter)
apiRouter.use('/memories', memoryRouter)

export { apiRouter }
