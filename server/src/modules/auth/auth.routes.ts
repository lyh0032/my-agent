import { Router } from 'express'

import { asyncHandler } from '../../utils/async-handler'
import { authMiddleware } from '../../middlewares/auth'
import { validate } from '../../middlewares/validate'
import { loginController, meController, registerController } from './auth.controller'
import { loginBodySchema, registerBodySchema } from './auth.schema'

const router = Router()

router.post('/register', validate({ body: registerBodySchema }), asyncHandler(registerController))
router.post('/login', validate({ body: loginBodySchema }), asyncHandler(loginController))
router.get('/me', authMiddleware, asyncHandler(meController))

export { router as authRouter }
