<template>
  <div class="chat-layout">
    <aside class="chat-layout__sidebar">
      <div class="chat-layout__brand">
        <span class="chat-layout__eyebrow">Workspace</span>
        <h1>My Agent</h1>
      </div>
      <ConversationList
        :conversations="chatStore.conversations"
        :active-conversation-id="chatStore.activeConversationId"
        @create="handleCreateConversation"
        @select="handleSelectConversation"
      />
      <div class="chat-layout__sidebar-actions">
        <el-button plain @click="router.push('/memories')">管理记忆</el-button>
        <el-button text @click="handleLogout">退出登录</el-button>
      </div>
    </aside>

    <main class="chat-layout__main">
      <header class="chat-layout__header">
        <div>
          <span class="chat-layout__eyebrow">Active Conversation</span>
          <h2>{{ chatStore.activeConversation?.title || '未选择会话' }}</h2>
        </div>
        <span class="chat-layout__user">{{ authStore.user?.username }}</span>
      </header>

      <section class="chat-layout__messages">
        <MessageList :messages="chatStore.messages" :streaming="chatStore.isSending" />
      </section>

      <footer class="chat-layout__composer">
        <MessageComposer :loading="chatStore.isSending" @submit="handleSendMessage" />
      </footer>
    </main>
  </div>
</template>

<script setup lang="ts">
import { onMounted, watch } from 'vue'
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

onMounted(async () => {
  await chatStore.loadConversations()

  const conversationId = route.query.conversationId
  if (typeof conversationId === 'string') {
    await chatStore.selectConversation(conversationId)
  } else if (chatStore.activeConversationId) {
    await router.replace({
      path: '/chat',
      query: { conversationId: chatStore.activeConversationId }
    })
    await chatStore.selectConversation(chatStore.activeConversationId)
  }
})

watch(
  () => route.query.conversationId,
  async (conversationId) => {
    if (typeof conversationId === 'string' && conversationId !== chatStore.activeConversationId) {
      await chatStore.selectConversation(conversationId)
    }
  }
)

async function handleCreateConversation() {
  const conversation = await chatStore.createConversation()
  await router.push({ path: '/chat', query: { conversationId: conversation.id } })
}

async function handleSelectConversation(conversationId: string) {
  await router.push({ path: '/chat', query: { conversationId } })
}

async function handleSendMessage(content: string) {
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

<style scoped>
.chat-layout {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 320px 1fr;
}

.chat-layout__sidebar {
  display: grid;
  grid-template-rows: auto 1fr auto;
  gap: 16px;
  padding: 20px;
  background: rgba(255, 255, 255, 0.7);
  border-right: 1px solid rgba(18, 52, 88, 0.08);
  backdrop-filter: blur(18px);
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
  display: grid;
  gap: 10px;
}

.chat-layout__main {
  display: grid;
  grid-template-rows: auto 1fr auto;
  padding: 24px;
  gap: 20px;
}

.chat-layout__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.chat-layout__user {
  padding: 10px 14px;
  border-radius: 999px;
  background: rgba(18, 52, 88, 0.08);
  font-weight: 600;
}

.chat-layout__messages {
  min-height: 0;
  padding: 8px 0;
}

.chat-layout__composer {
  padding-top: 8px;
}

@media (max-width: 960px) {
  .chat-layout {
    grid-template-columns: 1fr;
  }

  .chat-layout__sidebar {
    border-right: 0;
    border-bottom: 1px solid rgba(18, 52, 88, 0.08);
  }
}
</style>
