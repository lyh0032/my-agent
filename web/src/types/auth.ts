export type User = {
  id: string
  email: string
  username: string
  createdAt: string
}

export type AuthPayload = {
  token: string
  user: User
}

export type LoginInput = {
  emailOrUsername: string
  password: string
}

export type RegisterInput = {
  email: string
  username: string
  password: string
}
