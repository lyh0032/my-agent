<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, watch, ref, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'

import ConversationList from '../components/chat/ConversationList.vue'
import MessageComposer from '../components/chat/MessageComposer.vue'
import MessageList from '../components/chat/MessageList.vue'
import { useAuthStore } from '../stores/auth'
import { useChatStore } from '../stores/chat'
import type { ModelInfo } from '../types/chat'
import {
  fetchAvailableModels,
  fetchPreferredModel,
  updatePreferredModel
} from '../api/model-preference'
import { Plus } from '@element-plus/icons-vue'

const authStore = useAuthStore()
const chatStore = useChatStore()
const router = useRouter()
const route = useRoute()

const contentRef = ref<HTMLDivElement>()
const isMobile = ref(false)
const isSidebarOpen = ref(false)
const availableModels = ref<ModelInfo[]>([])
const selectedModelId = ref('')
const isLoadingModels = ref(false)
const conversationKeyword = ref('')

const MOBILE_BREAKPOINT = 960

const filteredConversations = computed(() => {
  const keyword = conversationKeyword.value.trim().toLowerCase()

  if (!keyword) {
    return chatStore.conversations
  }

  return chatStore.conversations.filter((conversation) => {
    const haystacks = [conversation.title, conversation.lastMessagePreview]
    return haystacks.some((value) => value.toLowerCase().includes(keyword))
  })
})

onMounted(async () => {
  syncViewport()
  window.addEventListener('resize', syncViewport)

  await chatStore.loadConversations()
  await loadModelPreferences()

  const conversationId = route.query.conversationId
  if (typeof conversationId === 'string') {
    await chatStore.selectConversation(conversationId)
  } else if (chatStore.activeConversationId) {
    await router.replace({
      path: '/chat',
      query: {
        conversationId: chatStore.activeConversationId
      }
    })
    await chatStore.selectConversation(chatStore.activeConversationId)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', syncViewport)
  chatStore.detachActiveStream()
})

watch(
  () => route.query.conversationId,
  async (conversationId) => {
    if (typeof conversationId === 'string' && conversationId !== chatStore.activeConversationId) {
      await chatStore.selectConversation(conversationId)
      await nextTick()
      scrollToBottom(false)
    }
  }
)

watch(
  () => chatStore.messages,
  () => {
    nextTick(() => {
      scrollToBottom(false)
    })
  },
  {
    deep: true
  }
)

function scrollToBottom(animated = true) {
  const container = contentRef.value
  if (!container) {
    return
  }

  const top = container.scrollHeight

  if ('scrollTo' in container) {
    try {
      container.scrollTo({
        top,
        behavior: animated ? 'smooth' : 'auto'
      })
      return
    } catch (error) {
      console.warn('聊天区域滚动失败，降级为直接滚动', error)
    }
  }

  container.scrollTop = top
}

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

async function handleCreateConversation() {
  const conversation = await chatStore.createConversation()
  await router.push({
    path: '/chat',
    query: {
      conversationId: conversation.id
    }
  })
  closeSidebar()
}

async function handleSelectConversation(conversationId: string) {
  await router.push({
    path: '/chat',
    query: {
      conversationId
    }
  })
  closeSidebar()
}

async function handleDeleteConversation(conversationId: string) {
  await chatStore.deleteConversation(conversationId)
  await chatStore.loadConversations()
  if (chatStore.conversations.length > 0) {
    await router.replace({
      query: {
        conversationId: chatStore.activeConversationId
      }
    })
  } else {
    await router.replace({
      query: void 0
    })
  }

  closeSidebar()
}

function handleConversationKeywordChange(value: string | number | undefined) {
  conversationKeyword.value = typeof value === 'string' ? value : ''
}

async function handleTogglePinConversation(conversationId: string, isPinned: boolean) {
  await chatStore.toggleConversationPin(conversationId, isPinned)
}

async function handleSendMessage(content: string) {
  scrollToBottom(false)
  const hadConversation = Boolean(chatStore.activeConversationId)
  const result = await chatStore.sendMessage(content)

  if (!hadConversation) {
    await router.replace({ path: '/chat', query: { conversationId: result.conversationId } })
  }
}

async function handleStopStreaming() {
  await chatStore.stopStreaming()
}

async function loadModelPreferences() {
  isLoadingModels.value = true
  try {
    const [models, preferred] = await Promise.all([fetchAvailableModels(), fetchPreferredModel()])

    availableModels.value = models
    selectedModelId.value = preferred.id
  } catch (error) {
    console.error('Failed to load model preferences:', error)
  } finally {
    isLoadingModels.value = false
  }
}

async function handleModelChange(modelId: string) {
  try {
    await updatePreferredModel({ modelId })
    ElMessage.success('模型已切换')
  } catch (error) {
    ElMessage.error('切换模型失败')
  }
}

async function handleLogout() {
  authStore.logout()
  await router.push('/login')
}
</script>

<template>
  <div class="chat-layout">
    <button
      v-if="isMobile && isSidebarOpen"
      class="chat-layout-backdrop"
      type="button"
      aria-label="关闭侧边菜单"
      @click="closeSidebar"
    ></button>

    <aside class="chat-layout-sidebar" :class="{ 'chat-layout-sidebar--open': isSidebarOpen }">
      <div class="chat-layout-brand">
        <div>
          <span class="chat-layout-eyebrow">Workspace</span>
          <h1>My Agent</h1>
        </div>
        <button
          v-if="isMobile"
          class="chat-layout-icon-button"
          type="button"
          aria-label="关闭侧边菜单"
          @click="closeSidebar"
        >
          <span></span>
          <span></span>
        </button>
      </div>
      <div class="chat-layout-conversation-tools">
        <el-input
          :model-value="conversationKeyword"
          placeholder="搜索会话"
          clearable
          @update:model-value="handleConversationKeywordChange"
        />
        <el-button :icon="Plus" circle @click="handleCreateConversation"></el-button>
      </div>
      <ConversationList
        :conversations="filteredConversations"
        :active-conversation-id="chatStore.activeConversationId"
        @select="handleSelectConversation"
        @toggle-pin="handleTogglePinConversation"
        @delete="handleDeleteConversation"
      />
      <div class="chat-layout-model-selector"></div>
      <div class="chat-layout-sidebar-actions">
        <el-select
          v-model="selectedModelId"
          placeholder="选择模型"
          size="default"
          :loading="isLoadingModels"
          @change="handleModelChange"
        >
          <el-option
            v-for="model in availableModels"
            :key="model.id"
            :label="model.name"
            :value="model.id"
          >
            <span>{{ model.name }}</span>
            <span class="chat-layout-model-desc">{{ model.description }}</span>
          </el-option>
        </el-select>
        <el-button plain @click="router.push('/memories')">管理记忆</el-button>
        <el-button @click="handleLogout">退出登录</el-button>
      </div>
    </aside>

    <main class="chat-layout-main">
      <header class="chat-layout-header">
        <div class="chat-layout-header-main">
          <button
            v-if="isMobile"
            class="chat-layout-icon-button"
            type="button"
            aria-label="打开侧边菜单"
            @click="openSidebar"
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
          <div>
            <span class="chat-layout-eyebrow">Active Conversation</span>
            <h2>{{ chatStore.activeConversation?.title || '未选择会话' }}</h2>
          </div>
        </div>
        <span class="chat-layout-user">{{ authStore.user?.username }}</span>
      </header>

      <div class="chat-layout-content" ref="contentRef">
        <div class="chat-layout-content-inner">
          <section class="chat-layout-messages" :key="route.query.conversationId as string">
            <MessageList
              :messages="chatStore.messages"
              :streaming="chatStore.isSending"
              :thinking-text="chatStore.streamingStatusText"
            />
          </section>
        </div>
      </div>

      <footer class="chat-layout-composer">
        <div class="chat-layout-composer-content">
          <MessageComposer
            :loading="chatStore.isSending"
            :can-stop="chatStore.isSending"
            @submit="handleSendMessage"
            @cancel="handleStopStreaming"
          />
        </div>
      </footer>
    </main>
  </div>
</template>

<style scoped lang="less">
.chat-layout {
  --chat-content-max-width: 800px;
  --chat-composer-height: 142px;
  width: 100%;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  display: flex;
  position: relative;
  background: rgba(255, 255, 255, 0.16);

  &-sidebar {
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

  &-brand {
    padding: 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;

    h1 {
      margin: 0;
    }
  }

  &-conversation-tools {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 0 16px 16px;
    border-bottom: 1px solid rgba(18, 52, 88, 0.2);
  }

  &-conversation-title {
    font-size: 18px;
    font-weight: 600;
  }

  &-eyebrow {
    display: inline-block;
    margin-bottom: 8px;
    color: #8c5c2a;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  &-sidebar-actions {
    padding: 16px;
    display: grid;
    gap: 10px;
    box-shadow: 0px -3px 16px 0px rgb(210 210 210 / 50%);

    .el-button {
      width: 100%;
      margin: 0;
    }
  }

  &-model-desc {
    margin-left: 8px;
    color: #999;
    font-size: 12px;
  }

  &-main {
    flex: 1;
    width: 0;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  &-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 16px;
    border-bottom: 1px solid rgba(18, 52, 88, 0.2);

    h2 {
      margin: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  &-header-main {
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 12px;

    > div {
      min-width: 0;
    }
  }

  &-user {
    padding: 10px 14px;
    border-radius: 999px;
    background: rgba(18, 52, 88, 0.08);
    font-weight: 600;
    white-space: nowrap;
  }

  &-content {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 16px;

    &::-webkit-scrollbar {
      display: none;
      width: 0;
    }
  }

  &-content-inner {
    width: min(100%, var(--chat-content-max-width));
    min-height: 100%;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
  }

  &-messages {
    flex: 1;
    min-height: 0;
    position: relative;
  }

  &-composer {
    padding: 0 16px 16px;
  }

  &-composer-content {
    width: min(100%, var(--chat-content-max-width));
    margin: 0 auto;
  }

  &-backdrop {
    position: absolute;
    inset: 0;
    border: 0;
    padding: 0;
    background: rgba(8, 15, 24, 0.38);
    z-index: 2;
  }

  &-icon-button {
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

    span {
      width: 16px;
      height: 2px;
      border-radius: 999px;
      background: currentColor;
    }
  }
}

@media (max-width: 960px) {
  .chat-layout {
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
      border-right: 1px solid rgba(18, 52, 88, 0.08);
      box-shadow: 0 18px 50px rgba(18, 52, 88, 0.24);
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

    &-user {
      max-width: 42%;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    &-messages {
      min-height: 0;
    }

    &-content {
      padding: 0 14px;
    }

    &-content-inner {
      padding-top: 16px;
      padding-bottom: 16px;
    }
  }
}

@media (max-width: 640px) {
  .chat-layout {
    &-header {
      gap: 12px;
      align-items: flex-start;

      h2 {
        font-size: 18px;
        white-space: normal;
      }
    }

    &-user {
      padding: 8px 12px;
      font-size: 13px;
    }
  }
}
</style>
