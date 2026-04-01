import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { fetchMe, login, register } from '../api/auth'
import type { LoginInput, RegisterInput, User } from '../types/auth'
import { clearStoredToken, getStoredToken, setStoredToken } from '../utils/token'

export const useAuthStore = defineStore('auth', () => {
  const token = ref(getStoredToken())
  const user = ref<User | null>(null)
  const isRestoring = ref(false)

  const isAuthenticated = computed(() => Boolean(token.value && user.value))

  function applySession(nextToken: string, nextUser: User) {
    token.value = nextToken
    user.value = nextUser
    setStoredToken(nextToken)
  }

  async function registerAction(input: RegisterInput) {
    const data = await register(input)
    applySession(data.token, data.user)
  }

  async function loginAction(input: LoginInput) {
    const data = await login(input)
    applySession(data.token, data.user)
  }

  async function restoreSession() {
    const storedToken = getStoredToken()

    if (!storedToken) {
      return
    }

    isRestoring.value = true
    token.value = storedToken

    try {
      user.value = await fetchMe()
    } catch {
      logout()
    } finally {
      isRestoring.value = false
    }
  }

  function logout() {
    token.value = ''
    user.value = null
    clearStoredToken()
  }

  return {
    token,
    user,
    isRestoring,
    isAuthenticated,
    register: registerAction,
    login: loginAction,
    restoreSession,
    logout
  }
})
