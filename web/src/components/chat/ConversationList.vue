<template>
  <div class="conversation-list">
    <div class="conversation-list-scroll">
      <template v-if="conversations.length > 0">
        <div
          v-for="conversation in conversations"
          :key="conversation.id"
          class="conversation-item"
          :class="{ 'conversation-item--active': conversation.id === activeConversationId }"
          @click="$emit('select', conversation.id)"
        >
          <div class="conversation-item-left">
            <div class="conversation-item-title-row">
              <span v-if="conversation.isPinned" class="conversation-item-pin-tag">已置顶</span>
              <span class="conversation-item-title">{{ conversation.title }}</span>
            </div>
            <span class="conversation-item-preview">{{
              conversation.lastMessagePreview || '暂无消息'
            }}</span>
          </div>
          <div class="conversation-item-right">
            <el-button
              :icon="conversation.isPinned ? ArrowDown : ArrowUp"
              text
              size="small"
              @click="onTogglePin($event, conversation)"
            ></el-button>
            <el-button
              :icon="DeleteFilled"
              text
              size="small"
              @click="onDelete($event, conversation)"
            ></el-button>
          </div>
        </div>
      </template>
      <div v-else class="conversation-list-empty">没有匹配的会话</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ElMessageBox } from 'element-plus'
import type { ConversationSummary } from '../../types/chat'
import { ArrowDown, ArrowUp, DeleteFilled } from '@element-plus/icons-vue'

defineProps<{
  conversations: ConversationSummary[]
  activeConversationId: string
}>()

const emit = defineEmits<{
  select: [conversationId: string]
  togglePin: [conversationId: string, isPinned: boolean]
  delete: [conversationId: string]
}>()

function onTogglePin(e: PointerEvent, conversation: ConversationSummary) {
  e.stopPropagation()
  e.preventDefault()
  emit('togglePin', conversation.id, !conversation.isPinned)
}

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

  &-scroll {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 16px;
    overflow-y: auto;
  }

  &-empty {
    padding: 12px;
    text-align: center;
    color: #7b8594;
    font-size: 13px;
  }
}

.conversation-item {
  flex-shrink: 0;
  width: 100%;
  border: 0;
  border-radius: 16px;
  background: transparent;
  padding: 12px;
  text-align: left;
  cursor: pointer;
  display: flex;
  overflow: hidden;
  background: rgba(18, 52, 88, 0.08);

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

  &-title-row {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  &-right {
    .el-button {
      padding: 0 6px;
      margin: 0;
    }
  }

  &:hover {
    .conversation-item-right {
      display: flex;
      align-items: center;
      justify-content: center;
    }
  }

  &--active {
    background: rgba(174, 213, 255, 0.517);
  }

  &-title {
    font-weight: 600;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  &-pin-tag {
    flex-shrink: 0;
    padding: 2px 8px;
    border-radius: 999px;
    background: rgba(140, 92, 42, 0.12);
    color: #8c5c2a;
    font-size: 12px;
    line-height: 1.4;
  }

  &-preview {
    color: #5f6774;
    font-size: 12px;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
}

@media (hover: none), (max-width: 960px) {
  .conversation-item {
    &-right {
      display: flex;
      align-items: center;
      justify-content: center;
    }
  }
}
</style>
