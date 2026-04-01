import { z } from 'zod'

export const registerBodySchema = z.object({
  email: z.string().trim().email(),
  username: z.string().trim().min(3).max(24),
  password: z.string().min(8).max(128)
})

export const loginBodySchema = z.object({
  emailOrUsername: z.string().trim().min(1),
  password: z.string().min(8).max(128)
})

export type RegisterBody = z.infer<typeof registerBodySchema>
export type LoginBody = z.infer<typeof loginBodySchema>
