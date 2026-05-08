import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export type ThemeMode = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'theme-mode'
let mediaQuery: MediaQueryList | null = null

function getStored(): ThemeMode {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (raw === 'light' || raw === 'dark' || raw === 'system') return raw
  return 'system'
}

function resolve(mode: ThemeMode): 'light' | 'dark' {
  if (mode !== 'system') return mode
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function apply(resolved: 'light' | 'dark') {
  const html = document.documentElement
  if (resolved === 'dark') {
    html.setAttribute('data-theme', 'dark')
  } else {
    html.removeAttribute('data-theme')
  }
}

export const useThemeStore = defineStore('theme', () => {
  const mode = ref<ThemeMode>(getStored())

  apply(resolve(mode.value))

  mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  const onChange = () => {
    if (mode.value === 'system') {
      apply(resolve('system'))
    }
  }
  mediaQuery.addEventListener('change', onChange)

  watch(mode, (val) => {
    localStorage.setItem(STORAGE_KEY, val)
    apply(resolve(val))
  })

  function setMode(val: ThemeMode) {
    mode.value = val
  }

  function cycle() {
    const order: ThemeMode[] = ['system', 'light', 'dark']
    const idx = order.indexOf(mode.value)
    mode.value = order[(idx + 1) % order.length]
  }

  return { mode, setMode, cycle }
})
