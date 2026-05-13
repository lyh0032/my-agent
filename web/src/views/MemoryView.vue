<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'

import { useMemoryStore } from '../stores/memory'
import type { MemoryType } from '../types/memory'

const router = useRouter()
const memoryStore = useMemoryStore()
const isMobile = ref(false)
const isSidebarOpen = ref(false)

const MOBILE_BREAKPOINT = 960

const memoryTypeLabelMap: Record<MemoryType, string> = {
  profile: '个人信息',
  preference: '偏好',
  summary: '总结',
  fact: '事实'
}

const memoryStats = computed(() => {
  const counts = memoryStore.memories.reduce<Record<MemoryType, number>>(
    (result, memory) => {
      result[memory.type] += 1
      return result
    },
    {
      profile: 0,
      preference: 0,
      summary: 0,
      fact: 0
    }
  )

  return (Object.keys(memoryTypeLabelMap) as MemoryType[]).map((type) => ({
    type,
    label: memoryTypeLabelMap[type],
    count: counts[type]
  }))
})

onMounted(async () => {
  syncViewport()
  window.addEventListener('resize', syncViewport)
  await memoryStore.loadMemories({})
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', syncViewport)
})

function syncViewport() {
  const mobile = window.innerWidth <= MOBILE_BREAKPOINT
  isMobile.value = mobile
  isSidebarOpen.value = !mobile
}

function openSidebar() {
  isSidebarOpen.value = true
}

function closeSidebar() {
  if (isMobile.value) {
    isSidebarOpen.value = false
  }
}

async function handleDelete(memoryId: string) {
  try {
    await ElMessageBox.confirm('删除后不可恢复，确认删除这条长期记忆吗？', '删除记忆', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    })

    await memoryStore.deleteMemory(memoryId)
    ElMessage.success('记忆已删除')
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除记忆失败')
    }
  }
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value))
}
</script>

<template>
  <div class="memory-layout">
    <button
      v-if="isMobile && isSidebarOpen"
      class="memory-layout-backdrop"
      type="button"
      aria-label="关闭侧边菜单"
      @click="closeSidebar"
    ></button>

    <aside class="memory-layout-sidebar" :class="{ 'memory-layout-sidebar--open': isSidebarOpen }">
      <div class="memory-layout-brand">
        <div>
          <span class="memory-layout-eyebrow">Workspace</span>
          <h1>Memory</h1>
        </div>
        <button
          v-if="isMobile"
          class="memory-layout-icon-button"
          type="button"
          aria-label="关闭侧边菜单"
          @click="closeSidebar"
        >
          <span></span>
          <span></span>
        </button>
      </div>

      <div class="memory-layout-summary">
        <p class="memory-layout-summary-title">长期记忆概览</p>
        <p class="memory-layout-summary-text">
          这里展示你和系统从对话中沉淀下来的关键信息，你可以随时删除。
        </p>
      </div>

      <div class="memory-layout-stats">
        <article class="memory-layout-stat-card">
          <span>总记忆数</span>
          <strong>{{ memoryStore.memories.length }}</strong>
        </article>
        <article v-for="item in memoryStats" :key="item.type" class="memory-layout-stat-card">
          <span>{{ item.label }}</span>
          <strong>{{ item.count }}</strong>
        </article>
      </div>

      <div class="memory-layout-sidebar-actions">
        <el-button plain @click="router.push('/chat')">返回聊天</el-button>
      </div>
    </aside>

    <main class="memory-layout-main">
      <header class="memory-layout-header">
        <div class="memory-layout-header-main">
          <button
            v-if="isMobile"
            class="memory-layout-icon-button"
            type="button"
            aria-label="打开侧边菜单"
            @click="openSidebar"
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
          <div>
            <span class="memory-layout-eyebrow">Long-term Context</span>
            <h2>记忆管理</h2>
          </div>
        </div>
        <span class="memory-layout-count">{{ memoryStore.memories.length }} 条记忆</span>
      </header>

      <section class="memory-layout-content" v-loading="memoryStore.isLoading">
        <div
          v-if="!memoryStore.isLoading && memoryStore.memories.length === 0"
          class="memory-layout-state memory-layout-state--empty"
        >
          <h3>还没有长期记忆</h3>
          <p>当用户在对话中表达稳定且重要的信息时，系统会自动提取并保存在这里。</p>
        </div>

        <div v-else class="memory-layout-grid">
          <article v-for="memory in memoryStore.memories" :key="memory.id" class="memory-card">
            <div class="memory-card-header">
              <div class="memory-card-meta">
                <span class="memory-card-badge">{{ memoryTypeLabelMap[memory.type] }}</span>
                <h3>{{ memory.key }}</h3>
              </div>
              <el-button link type="danger" @click="handleDelete(memory.id)">删除</el-button>
            </div>

            <p class="memory-card-content">{{ memory.content }}</p>

            <div class="memory-card-footer">
              <span>更新时间</span>
              <time :datetime="memory.updatedAt">{{ formatDate(memory.updatedAt) }}</time>
            </div>
          </article>
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped lang="less">
.memory-layout {
  width: 100%;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  display: flex;
  position: relative;
  background: transparent;

  &-sidebar {
    background: var(--bg-sidebar);
    border-right: 1px solid var(--border-light);
    backdrop-filter: blur(18px);
    width: 300px;
    height: 100%;
    display: flex;
    flex-shrink: 0;
    flex-direction: column;
    position: relative;
    z-index: 3;
  }

  &-brand,
  &-header {
    padding: 16px;
    display: flex;
    gap: 12px;
    align-items: center;
    justify-content: space-between;
  }

  &-brand h1,
  &-header h2,
  &-summary-title,
  &-state h3,
  .memory-card-meta h3 {
    margin: 0;
  }

  &-eyebrow {
    display: inline-block;
    margin-bottom: 8px;
    color: var(--accent-warm);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  &-summary {
    margin: 0 16px;
    padding: 18px;
    border-radius: 24px;
    background: var(--bg-warm);
    display: grid;
    gap: 10px;
  }

  &-summary-title {
    font-size: 18px;
    font-weight: 700;
    color: var(--accent);
  }

  &-summary-text {
    margin: 0;
    color: var(--text-muted);
    line-height: 1.7;
  }

  &-stats {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: grid;
    align-content: start;
    gap: 12px;
  }

  &-stat-card {
    padding: 16px 18px;
    border-radius: 20px;
    background: var(--bg-element);
    border: 1px solid var(--border-light);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;

    span {
      color: var(--text-muted);
    }

    strong {
      font-size: 26px;
      color: var(--accent);
    }
  }

  &-sidebar-actions {
    padding: 16px;
    display: grid;
    gap: 10px;
    box-shadow: var(--shadow-sidebar);

    .el-button {
      width: 100%;
      margin: 0;
    }
  }

  &-main {
    flex: 1;
    width: 0;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  &-header {
    border-bottom: 1px solid var(--border-medium);
  }

  &-header-main {
    min-width: 0;
    display: flex;
    align-items: flex-start;
    gap: 12px;
  }

  &-count {
    padding: 10px 14px;
    border-radius: 999px;
    background: var(--bg-badge);
    font-weight: 600;
    white-space: nowrap;
  }

  &-content {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 20px;
  }

  &-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
  }

  &-state {
    min-height: 100%;
    display: grid;
    place-items: center;
    text-align: center;
    padding: 32px;
    color: var(--text-muted);

    &--empty {
      gap: 12px;
    }

    p {
      max-width: 460px;
      margin: 0;
      line-height: 1.7;
    }
  }
}

.memory-card {
  display: grid;
  gap: 18px;
  padding: 20px;
  border-radius: 28px;
  background: var(--bg-surface);
  border: 1px solid var(--border-light);
  box-shadow: var(--shadow-md);

  &-header,
  &-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  &-meta {
    min-width: 0;
    display: grid;
    gap: 10px;

    h3 {
      font-size: 20px;
      line-height: 1.3;
      color: var(--text-primary);
      word-break: break-word;
    }
  }

  &-badge {
    display: inline-flex;
    width: fit-content;
    padding: 6px 10px;
    border-radius: 999px;
    background: var(--bg-chip-image);
    color: var(--color-chip-image);
    font-size: 12px;
    font-weight: 700;
  }

  &-content {
    margin: 0;
    color: var(--text-primary);
    line-height: 1.8;
    word-break: break-word;
  }

  &-footer {
    padding-top: 14px;
    border-top: 1px solid var(--border-light);
    color: var(--text-muted-light);
    font-size: 13px;
  }
}

.memory-layout-backdrop {
  position: absolute;
  inset: 0;
  border: 0;
  padding: 0;
  background: var(--bg-backdrop);
  z-index: 2;
}

.memory-layout-icon-button {
  width: 42px;
  height: 42px;
  display: inline-flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 4px;
  border: 1px solid var(--border-color);
  border-radius: 14px;
  background: var(--bg-element);
  color: var(--accent);
  cursor: pointer;
  flex-shrink: 0;

  span {
    width: 16px;
    height: 2px;
    border-radius: 999px;
    background: currentColor;
  }
}

@media (max-width: 1180px) {
  .memory-layout {
    &-grid {
      grid-template-columns: 1fr;
    }
  }
}

@media (max-width: 960px) {
  .memory-layout {
    display: block;

    &-main {
      width: 100%;
      height: 100%;
    }

    &-sidebar {
      position: absolute;
      inset: 0 auto 0 0;
      width: min(84vw, 320px);
      max-width: 320px;
      border-right: 1px solid var(--border-light);
      box-shadow: var(--shadow-mobile-sidebar);
      transform: translateX(-100%);
      transition: transform 0.24s ease;

      &--open {
        transform: translateX(0);
      }
    }

    &-header {
      align-items: center;
      padding: 12px 16px;
    }

    &-count {
      max-width: 42%;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    &-content {
      padding: 16px;
    }
  }
}

@media (max-width: 640px) {
  .memory-layout {
    &-header {
      gap: 12px;
      align-items: flex-start;

      h2 {
        font-size: 18px;
        white-space: normal;
      }
    }

    &-count {
      padding: 8px 12px;
      font-size: 13px;
    }

    &-content {
      padding: 12px;
    }
  }

  .memory-card {
    padding: 16px;
    border-radius: 22px;

    &-header,
    &-footer {
      align-items: flex-start;
      flex-direction: column;
    }

    &-header :deep(.el-button) {
      padding-left: 0;
    }
  }
}
</style>
