import axios from 'axios'
import { ElMessage } from 'element-plus'

import { clearStoredToken, getStoredToken } from '../utils/token'

function normalizeBaseUrl(rawBaseUrl?: string): string {
  const trimmed = rawBaseUrl?.trim()

  if (!trimmed || trimmed === 'undefined') {
    return '/api'
  }

  return `${trimmed.replace(/\/$/, '')}/api`
}

export const apiBaseUrl = normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL)

export const http = axios.create({
  baseURL: apiBaseUrl
})

http.interceptors.request.use((config) => {
  const token = getStoredToken()

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

http.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status
    const message = error.response?.data?.message ?? '请求失败'

    if (status === 401) {
      clearStoredToken()
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }

    ElMessage.error(message)
    return Promise.reject(error)
  }
)
