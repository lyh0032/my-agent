import { ElMessage } from 'element-plus'

import { clearStoredToken, getStoredToken } from '../utils/token'
import type { ApiErrorResponse } from '../types/api'

function normalizeBaseUrl(rawBaseUrl?: string): string {
  const trimmed = rawBaseUrl?.trim()

  if (!trimmed || trimmed === 'undefined') {
    return '/api'
  }

  return `${trimmed.replace(/\/$/, '')}/api`
}

export const apiBaseUrl = normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL)

function createAuthHeaders(headers?: HeadersInit): Headers {
  const normalizedHeaders = new Headers(headers)
  const token = getStoredToken()

  if (token) {
    normalizedHeaders.set('Authorization', `Bearer ${token}`)
  }

  return normalizedHeaders
}

function handleUnauthorized() {
  clearStoredToken()
  if (window.location.pathname !== '/login') {
    window.location.href = '/login'
  }
}

async function parseResponseBody<T>(response: Response): Promise<T> {
  if (response.status === 204) {
    return undefined as T
  }

  const contentType = response.headers.get('content-type') ?? ''

  if (contentType.includes('application/json')) {
    return (await response.json()) as T
  }

  return (await response.text()) as T
}

function buildUrl(path: string, params?: Record<string, unknown>): string {
  const url = new URL(`${apiBaseUrl}${path}`, window.location.origin)

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value == null || value === '') {
        continue
      }

      if (Array.isArray(value)) {
        for (const item of value) {
          url.searchParams.append(key, String(item))
        }
        continue
      }

      url.searchParams.set(key, String(value))
    }
  }

  return `${url.pathname}${url.search}`
}

async function handleErrorResponse(response: Response): Promise<never> {
  const payload = await parseResponseBody<ApiErrorResponse | string | null>(response)
  const message =
    typeof payload === 'string' ? payload || '请求失败' : payload?.message || '请求失败'

  if (response.status === 401) {
    handleUnauthorized()
  }

  ElMessage.error(message)

  const error = new Error(message) as Error & {
    status: number
    payload: ApiErrorResponse | string | null
  }

  error.status = response.status
  error.payload = payload

  throw error
}

type RequestOptions = {
  body?: unknown
  headers?: HeadersInit
  params?: Record<string, unknown>
  signal?: AbortSignal
}

async function request<T>(method: string, path: string, options: RequestOptions = {}) {
  const headers = createAuthHeaders(options.headers)

  if (options.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(buildUrl(path, options.params), {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal
  })

  if (!response.ok) {
    return handleErrorResponse(response)
  }

  const data = await parseResponseBody<T>(response)

  return {
    data,
    status: response.status,
    headers: response.headers
  }
}

export function fetchWithAuth(path: string, init: RequestInit = {}) {
  return fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: createAuthHeaders(init.headers)
  })
}

export async function ensureFetchResponseOk(response: Response, fallbackMessage: string) {
  if (response.ok) {
    return response
  }

  if (response.status === 401) {
    handleUnauthorized()
    throw new Error('未登录或登录已过期')
  }

  const payload = await parseResponseBody<ApiErrorResponse | string | null>(response)
  const message =
    typeof payload === 'string' ? payload || fallbackMessage : payload?.message || fallbackMessage

  ElMessage.error(message)
  throw new Error(message)
}

export const http = {
  get<T>(path: string, options?: Omit<RequestOptions, 'body'>) {
    return request<T>('GET', path, options)
  },
  post<T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'body'>) {
    return request<T>('POST', path, { ...options, body })
  },
  put<T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'body'>) {
    return request<T>('PUT', path, { ...options, body })
  },
  patch<T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'body'>) {
    return request<T>('PATCH', path, { ...options, body })
  },
  delete<T>(path: string, options?: Omit<RequestOptions, 'body'>) {
    return request<T>('DELETE', path, options)
  }
}
