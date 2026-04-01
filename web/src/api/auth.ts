import type { ApiResponse } from '../types/api'
import type { AuthPayload, LoginInput, RegisterInput, User } from '../types/auth'
import { http } from './http'

export async function register(input: RegisterInput): Promise<AuthPayload> {
  const response = await http.post<ApiResponse<AuthPayload>>('/auth/register', input)
  return response.data.data
}

export async function login(input: LoginInput): Promise<AuthPayload> {
  const response = await http.post<ApiResponse<AuthPayload>>('/auth/login', input)
  return response.data.data
}

export async function fetchMe(): Promise<User> {
  const response = await http.get<ApiResponse<User>>('/auth/me')
  return response.data.data
}
