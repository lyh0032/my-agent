import type { Request, Response } from 'express'

import { getCurrentUser, login, register } from './auth.service'
import { sendSuccess } from '../../utils/http'

export async function registerController(req: Request, res: Response) {
  const data = await register(req.body)
  sendSuccess(res, data, '注册成功', 201)
}

export async function loginController(req: Request, res: Response) {
  const data = await login(req.body)
  sendSuccess(res, data, '登录成功')
}

export async function meController(req: Request, res: Response) {
  const user = await getCurrentUser(req.currentUser!.id)
  sendSuccess(res, user, '获取当前用户成功')
}
