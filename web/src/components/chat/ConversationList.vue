<template>
  <div class="conversation-list" ref="triggerRef">
    <div class="conversation-list__header">
      <div class="conversation-list__header__title">会话</div>
      <el-button type="primary" text @click="$emit('create')">新建</el-button>
    </div>
    <div class="conversation-list__scroll">
      <template v-for="conversation in conversations" :key="conversation.id">
        <div
          class="conversation-item"
          :class="{ 'conversation-item--active': conversation.id === activeConversationId }"
          @click="$emit('select', conversation.id)"
        >
          <div class="conversation-item-left">
            <span class="conversation-item__title">{{ conversation.title }}</span>
            <span class="conversation-item__preview">{{
              conversation.lastMessagePreview || '暂无消息'
            }}</span>
          </div>
          <div class="conversation-item-right">
            <span @click="onDelete($event, conversation)">删除</span>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ElButton, ElMessageBox } from 'element-plus'
import type { ConversationSummary } from '../../types/chat'

defineProps<{
  conversations: ConversationSummary[]
  activeConversationId: string
}>()

const emit = defineEmits<{
  create: []
  select: [conversationId: string]
  delete: [conversationId: string]
}>()

async function onDelete(e: PointerEvent, conversation: ConversationSummary) {
  e.stopPropagation()
  e.preventDefault()
  await ElMessageBox.confirm('确定要删除这个会话吗？', '删除会话', {
    confirmButtonText: '删除',
    cancelButtonText: '取消',
    type: 'warning'
  })
  emit('delete', conversation.id)
}
</script>

<style scoped lang="less">
.conversation-list {
  display: flex;
  height: 100%;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
}

.conversation-list__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 16px 16px 16px;

  &__title {
    font-size: 18px;
    font-weight: 600;
  }
}

.conversation-list__scroll {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  overflow-y: auto;
}

.conversation-item {
  width: 100%;
  border: 0;
  border-radius: 16px;
  background: transparent;
  padding: 12px;
  text-align: left;
  cursor: pointer;
  display: flex;
  overflow: hidden;

  &-left {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
    overflow: hidden;
  }

  &-right {
    display: none;
    margin-left: 12px;

    > span {
      color: #ff4d4f;
      font-size: 14px;
    }
  }
}

.conversation-item:hover {
  .conversation-item-right {
    display: flex;
    align-items: center;
    justify-content: center;
  }
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
