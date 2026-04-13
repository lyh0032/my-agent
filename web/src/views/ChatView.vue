<template>
  <div class="chat-layout">
    <button
      v-if="isMobile && isSidebarOpen"
      class="chat-layout__backdrop"
      type="button"
      aria-label="关闭侧边菜单"
      @click="closeSidebar"
    ></button>

    <aside class="chat-layout__sidebar" :class="{ 'chat-layout__sidebar--open': isSidebarOpen }">
      <div class="chat-layout__brand">
        <div>
          <span class="chat-layout__eyebrow">Workspace</span>
          <h1>My Agent</h1>
        </div>
        <button
          v-if="isMobile"
          class="chat-layout__icon-button"
          type="button"
          aria-label="关闭侧边菜单"
          @click="closeSidebar"
        >
          <span></span>
          <span></span>
        </button>
      </div>
      <ConversationList
        :conversations="chatStore.conversations"
        :active-conversation-id="chatStore.activeConversationId"
        @create="handleCreateConversation"
        @select="handleSelectConversation"
        @delete="handleDeleteConversation"
      />
      <div class="chat-layout__sidebar-actions">
        <!-- <el-button plain @click="router.push('/memories')">管理记忆</el-button> -->
        <el-button @click="handleLogout">退出登录</el-button>
      </div>
    </aside>

    <main class="chat-layout__main">
      <header class="chat-layout__header">
        <div class="chat-layout__header-main">
          <button
            v-if="isMobile"
            class="chat-layout__icon-button"
            type="button"
            aria-label="打开侧边菜单"
            @click="openSidebar"
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
          <div>
            <span class="chat-layout__eyebrow">Active Conversation</span>
            <h2>{{ chatStore.activeConversation?.title || '未选择会话' }}</h2>
          </div>
        </div>
        <span class="chat-layout__user">{{ authStore.user?.username }}</span>
      </header>

      <section class="chat-layout__messages" :key="route.query.conversationId as string">
        <MessageList
          ref="msgRef"
          :messages="chatStore.messages"
          :streaming="chatStore.isSending"
          :thinking-text="chatStore.streamingStatusText"
        />
      </section>

      <footer class="chat-layout__composer">
        <MessageComposer :loading="chatStore.isSending" @submit="handleSendMessage" />
      </footer>
    </main>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, watch, ref, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import ConversationList from '../components/chat/ConversationList.vue'
import MessageComposer from '../components/chat/MessageComposer.vue'
import MessageList from '../components/chat/MessageList.vue'
import { useAuthStore } from '../stores/auth'
import { useChatStore } from '../stores/chat'

const authStore = useAuthStore()
const chatStore = useChatStore()
const router = useRouter()
const route = useRoute()

const msgRef = ref<InstanceType<typeof MessageList>>()
const isMobile = ref(false)
const isSidebarOpen = ref(false)

const MOBILE_BREAKPOINT = 960

onMounted(async () => {
  syncViewport()
  window.addEventListener('resize', syncViewport)

  await chatStore.loadConversations()

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
  msgRef.value?.scrollToBottom(animated)
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

async function handleSendMessage(content: string) {
  scrollToBottom(false)
  const hadConversation = Boolean(chatStore.activeConversationId)
  const result = await chatStore.sendMessage(content)

  if (!hadConversation) {
    await router.replace({ path: '/chat', query: { conversationId: result.conversationId } })
  }
}

async function handleLogout() {
  authStore.logout()
  await router.push('/login')
}
</script>

<style scoped lang="less">
.chat-layout {
  width: 100%;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  display: flex;
  position: relative;
  background: rgba(255, 255, 255, 0.16);
}

.chat-layout__sidebar {
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

.chat-layout__brand {
  padding: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.chat-layout__brand h1,
.chat-layout__header h2 {
  margin: 0;
}

.chat-layout__eyebrow {
  display: inline-block;
  margin-bottom: 8px;
  color: #8c5c2a;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.chat-layout__sidebar-actions {
  padding: 16px;
  display: grid;
  gap: 10px;
  box-shadow: 0px -3px 16px 0px rgb(210 210 210 / 50%);
  .el-button {
    width: 100%;
    margin: 0px;
  }
}

.chat-layout__main {
  flex: 1;
  width: 0;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.chat-layout__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 16px;
  border-bottom: 1px solid rgba(18, 52, 88, 0.2);
}

.chat-layout__header-main {
  min-width: 0;
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.chat-layout__header-main > div {
  min-width: 0;
}

.chat-layout__header h2 {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat-layout__user {
  padding: 10px 14px;
  border-radius: 999px;
  background: rgba(18, 52, 88, 0.08);
  font-weight: 600;
  white-space: nowrap;
}

.chat-layout__messages {
  flex: 1;
  overflow: hidden;
  display: flex;
  justify-content: center;
}

.chat-layout__composer {
  padding: 16px;
  border-top: 1px solid rgba(18, 52, 88, 0.2);
}

.chat-layout__backdrop {
  position: absolute;
  inset: 0;
  border: 0;
  padding: 0;
  background: rgba(8, 15, 24, 0.38);
  z-index: 2;
}

.chat-layout__icon-button {
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

.chat-layout__icon-button span {
  width: 16px;
  height: 2px;
  border-radius: 999px;
  background: currentColor;
}

@media (max-width: 960px) {
  .chat-layout {
    display: block;
  }

  .chat-layout__main {
    width: 100%;
    height: 100%;
  }

  .chat-layout__sidebar {
    position: absolute;
    inset: 0 auto 0 0;
    width: min(84vw, 320px);
    max-width: 320px;
    border-right: 1px solid rgba(18, 52, 88, 0.08);
    box-shadow: 0 18px 50px rgba(18, 52, 88, 0.24);
    transform: translateX(-100%);
    transition: transform 0.24s ease;
  }

  .chat-layout__sidebar--open {
    transform: translateX(0);
  }

  .chat-layout__header {
    align-items: center;
    padding: 12px 16px;
  }

  .chat-layout__user {
    max-width: 42%;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .chat-layout__messages {
    min-height: 0;
  }

  .chat-layout__composer {
    padding: 12px;
  }
}

@media (max-width: 640px) {
  .chat-layout__header {
    gap: 12px;
    align-items: flex-start;
  }

  .chat-layout__header h2 {
    font-size: 18px;
    white-space: normal;
  }

  .chat-layout__user {
    padding: 8px 12px;
    font-size: 13px;
  }
}
</style>
