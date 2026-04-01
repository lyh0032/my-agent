import bcrypt from 'bcryptjs'

import { prisma } from '../../lib/prisma'
import { signToken } from '../../lib/jwt'
import { AppError } from '../../utils/app-error'
import type { LoginBody, RegisterBody } from './auth.schema'

type PublicUser = {
  id: string
  email: string
  username: string
  createdAt: Date
}

function toPublicUser(user: {
  id: string
  email: string
  username: string
  createdAt: Date
}): PublicUser {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    createdAt: user.createdAt
  }
}

export async function register(data: RegisterBody) {
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ email: data.email }, { username: data.username }]
    }
  })

  if (existingUser?.email === data.email) {
    throw new AppError(409, '邮箱已被使用', 'EMAIL_TAKEN')
  }

  if (existingUser?.username === data.username) {
    throw new AppError(409, '用户名已被使用', 'USERNAME_TAKEN')
  }

  const passwordHash = await bcrypt.hash(data.password, 10)

  const user = await prisma.user.create({
    data: {
      email: data.email,
      username: data.username,
      passwordHash
    },
    select: {
      id: true,
      email: true,
      username: true,
      createdAt: true
    }
  })

  return {
    token: signToken({ userId: user.id }),
    user: toPublicUser(user)
  }
}

export async function login(data: LoginBody) {
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ email: data.emailOrUsername }, { username: data.emailOrUsername }]
    }
  })

  if (!user) {
    throw new AppError(401, '账号或密码错误', 'INVALID_CREDENTIALS')
  }

  const passwordMatched = await bcrypt.compare(data.password, user.passwordHash)

  if (!passwordMatched) {
    throw new AppError(401, '账号或密码错误', 'INVALID_CREDENTIALS')
  }

  return {
    token: signToken({ userId: user.id }),
    user: toPublicUser(user)
  }
}

export async function getCurrentUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      username: true,
      createdAt: true
    }
  })

  if (!user) {
    throw new AppError(401, '用户不存在', 'UNAUTHORIZED')
  }

  return toPublicUser(user)
}
