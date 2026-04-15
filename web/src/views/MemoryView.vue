<template>
  <div class="memory-layout">
    <button
      v-if="isMobile && isSidebarOpen"
      class="memory-layout__backdrop"
      type="button"
      aria-label="关闭侧边菜单"
      @click="closeSidebar"
    ></button>

    <aside
      class="memory-layout__sidebar"
      :class="{ 'memory-layout__sidebar--open': isSidebarOpen }"
    >
      <div class="memory-layout__brand">
        <div>
          <span class="memory-layout__eyebrow">Workspace</span>
          <h1>Memory</h1>
        </div>
        <button
          v-if="isMobile"
          class="memory-layout__icon-button"
          type="button"
          aria-label="关闭侧边菜单"
          @click="closeSidebar"
        >
          <span></span>
          <span></span>
        </button>
      </div>

      <div class="memory-layout__summary">
        <p class="memory-layout__summary-title">长期记忆概览</p>
        <p class="memory-layout__summary-text">
          这里展示你和系统从对话中沉淀下来的关键信息，你可以随时删除。
        </p>
      </div>

      <div class="memory-layout__stats">
        <article class="memory-layout__stat-card">
          <span>总记忆数</span>
          <strong>{{ memoryStore.memories.length }}</strong>
        </article>
        <article v-for="item in memoryStats" :key="item.type" class="memory-layout__stat-card">
          <span>{{ item.label }}</span>
          <strong>{{ item.count }}</strong>
        </article>
      </div>

      <div class="memory-layout__sidebar-actions">
        <el-button plain @click="router.push('/chat')">返回聊天</el-button>
      </div>
    </aside>

    <main class="memory-layout__main">
      <header class="memory-layout__header">
        <div class="memory-layout__header-main">
          <button
            v-if="isMobile"
            class="memory-layout__icon-button"
            type="button"
            aria-label="打开侧边菜单"
            @click="openSidebar"
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
          <div>
            <span class="memory-layout__eyebrow">Long-term Context</span>
            <h2>记忆管理</h2>
          </div>
        </div>
        <span class="memory-layout__count">{{ memoryStore.memories.length }} 条记忆</span>
      </header>

      <section class="memory-layout__content">
        <div v-if="memoryStore.isLoading" class="memory-layout__state">正在加载记忆...</div>

        <div
          v-else-if="memoryStore.memories.length === 0"
          class="memory-layout__state memory-layout__state--empty"
        >
          <h3>还没有长期记忆</h3>
          <p>当用户在对话中表达稳定且重要的信息时，系统会自动提取并保存在这里。</p>
        </div>

        <div v-else class="memory-layout__grid">
          <article v-for="memory in memoryStore.memories" :key="memory.id" class="memory-card">
            <div class="memory-card__header">
              <div class="memory-card__meta">
                <span class="memory-card__badge">{{ memoryTypeLabelMap[memory.type] }}</span>
                <h3>{{ memory.key }}</h3>
              </div>
              <el-button link type="danger" @click="handleDelete(memory.id)">删除</el-button>
            </div>

            <p class="memory-card__content">{{ memory.content }}</p>

            <div class="memory-card__footer">
              <span>更新时间</span>
              <time :datetime="memory.updatedAt">{{ formatDate(memory.updatedAt) }}</time>
            </div>
          </article>
        </div>
      </section>
    </main>
  </div>
</template>

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

<style scoped lang="less">
.memory-layout {
  width: 100%;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  display: flex;
  position: relative;
  background: rgba(255, 255, 255, 0.16);
}

.memory-layout__sidebar {
  background: rgba(255, 255, 255, 0.7);
  border-right: 1px solid rgba(18, 52, 88, 0.08);
  backdrop-filter: blur(18px);
  width: 300px;
  height: 100%;
  display: flex;
  flex-shrink: 0;
  flex-direction: column;
  position: relative;
  z-index: 3;
}

.memory-layout__brand,
.memory-layout__header {
  padding: 16px;
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
}

.memory-layout__brand h1,
.memory-layout__header h2,
.memory-layout__summary-title,
.memory-layout__state h3,
.memory-card__meta h3 {
  margin: 0;
}

.memory-layout__eyebrow {
  display: inline-block;
  margin-bottom: 8px;
  color: #8c5c2a;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.memory-layout__summary {
  margin: 0 16px;
  padding: 18px;
  border-radius: 24px;
  background: linear-gradient(135deg, rgba(18, 52, 88, 0.08), rgba(140, 92, 42, 0.1));
  display: grid;
  gap: 10px;
}

.memory-layout__summary-title {
  font-size: 18px;
  font-weight: 700;
  color: #123458;
}

.memory-layout__summary-text {
  margin: 0;
  color: rgba(18, 52, 88, 0.72);
  line-height: 1.7;
}

.memory-layout__stats {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: grid;
  align-content: start;
  gap: 12px;
}

.memory-layout__stat-card {
  padding: 16px 18px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.66);
  border: 1px solid rgba(18, 52, 88, 0.08);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.memory-layout__stat-card span {
  color: rgba(18, 52, 88, 0.72);
}

.memory-layout__stat-card strong {
  font-size: 26px;
  color: #123458;
}

.memory-layout__sidebar-actions {
  padding: 16px;
  display: grid;
  gap: 10px;
  box-shadow: 0px -3px 16px 0px rgb(210 210 210 / 50%);
}

.memory-layout__sidebar-actions .el-button {
  width: 100%;
  margin: 0;
}

.memory-layout__main {
  flex: 1;
  width: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.memory-layout__header {
  border-bottom: 1px solid rgba(18, 52, 88, 0.2);
}

.memory-layout__header-main {
  min-width: 0;
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.memory-layout__count {
  padding: 10px 14px;
  border-radius: 999px;
  background: rgba(18, 52, 88, 0.08);
  font-weight: 600;
  white-space: nowrap;
}

.memory-layout__content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 20px;
}

.memory-layout__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.memory-layout__state {
  min-height: 100%;
  display: grid;
  place-items: center;
  text-align: center;
  padding: 32px;
  color: rgba(18, 52, 88, 0.72);
}

.memory-layout__state--empty {
  gap: 12px;
}

.memory-layout__state p {
  max-width: 460px;
  margin: 0;
  line-height: 1.7;
}

.memory-card {
  display: grid;
  gap: 18px;
  padding: 20px;
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.82);
  border: 1px solid rgba(18, 52, 88, 0.08);
  box-shadow: 0 18px 40px rgba(18, 52, 88, 0.08);
}

.memory-card__header,
.memory-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.memory-card__meta {
  min-width: 0;
  display: grid;
  gap: 10px;
}

.memory-card__badge {
  display: inline-flex;
  width: fit-content;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(140, 92, 42, 0.12);
  color: #8c5c2a;
  font-size: 12px;
  font-weight: 700;
}

.memory-card__meta h3 {
  font-size: 20px;
  line-height: 1.3;
  color: #123458;
  word-break: break-word;
}

.memory-card__content {
  margin: 0;
  color: rgba(18, 52, 88, 0.86);
  line-height: 1.8;
  word-break: break-word;
}

.memory-card__footer {
  padding-top: 14px;
  border-top: 1px solid rgba(18, 52, 88, 0.08);
  color: rgba(18, 52, 88, 0.64);
  font-size: 13px;
}

.memory-layout__backdrop {
  position: absolute;
  inset: 0;
  border: 0;
  padding: 0;
  background: rgba(8, 15, 24, 0.38);
  z-index: 2;
}

.memory-layout__icon-button {
  width: 42px;
  height: 42px;
  display: inline-flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 4px;
  border: 1px solid rgba(18, 52, 88, 0.12);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.72);
  color: #123458;
  cursor: pointer;
  flex-shrink: 0;
}

.memory-layout__icon-button span {
  width: 16px;
  height: 2px;
  border-radius: 999px;
  background: currentColor;
}

@media (max-width: 1180px) {
  .memory-layout__grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 960px) {
  .memory-layout {
    display: block;
  }

  .memory-layout__main {
    width: 100%;
    height: 100%;
  }

  .memory-layout__sidebar {
    position: absolute;
    inset: 0 auto 0 0;
    width: min(84vw, 320px);
    max-width: 320px;
    border-right: 1px solid rgba(18, 52, 88, 0.08);
    box-shadow: 0 18px 50px rgba(18, 52, 88, 0.24);
    transform: translateX(-100%);
    transition: transform 0.24s ease;
  }

  .memory-layout__sidebar--open {
    transform: translateX(0);
  }

  .memory-layout__header {
    align-items: center;
    padding: 12px 16px;
  }

  .memory-layout__count {
    max-width: 42%;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .memory-layout__content {
    padding: 16px;
  }
}

@media (max-width: 640px) {
  .memory-layout__header {
    gap: 12px;
    align-items: flex-start;
  }

  .memory-layout__header h2 {
    font-size: 18px;
    white-space: normal;
  }

  .memory-layout__count {
    padding: 8px 12px;
    font-size: 13px;
  }

  .memory-layout__content {
    padding: 12px;
  }

  .memory-card {
    padding: 16px;
    border-radius: 22px;
  }

  .memory-card__header,
  .memory-card__footer {
    align-items: flex-start;
    flex-direction: column;
  }

  .memory-card__header :deep(.el-button) {
    padding-left: 0;
  }
}
</style>
