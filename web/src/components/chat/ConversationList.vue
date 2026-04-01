<template>
  <div class="conversation-list">
    <div class="conversation-list__header">
      <h2>会话</h2>
      <el-button type="primary" text @click="$emit('create')">新建</el-button>
    </div>
    <el-scrollbar class="conversation-list__scroll">
      <button
        v-for="conversation in conversations"
        :key="conversation.id"
        class="conversation-item"
        :class="{ 'conversation-item--active': conversation.id === activeConversationId }"
        @click="$emit('select', conversation.id)"
      >
        <span class="conversation-item__title">{{ conversation.title }}</span>
        <span class="conversation-item__preview">{{
          conversation.lastMessagePreview || '暂无消息'
        }}</span>
      </button>
    </el-scrollbar>
  </div>
</template>

<script setup lang="ts">
import type { ConversationSummary } from '../../types/chat'

defineProps<{
  conversations: ConversationSummary[]
  activeConversationId: string
}>()

defineEmits<{
  create: []
  select: [conversationId: string]
}>()
</script>

<style scoped>
.conversation-list {
  display: flex;
  height: 100%;
  flex-direction: column;
}

.conversation-list__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 12px 8px;
}

.conversation-list__scroll {
  flex: 1;
}

.conversation-item {
  width: 100%;
  border: 0;
  border-radius: 16px;
  background: transparent;
  padding: 12px;
  text-align: left;
  display: grid;
  gap: 6px;
  cursor: pointer;
}

.conversation-item:hover,
.conversation-item--active {
  background: rgba(18, 52, 88, 0.08);
}

.conversation-item__title {
  font-weight: 600;
}

.conversation-item__preview {
  color: #5f6774;
  font-size: 13px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
</style>
