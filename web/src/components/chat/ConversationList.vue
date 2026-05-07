<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { ElMessageBox } from 'element-plus'
import type { ConversationSummary } from '../../types/chat'
import { MoreFilled } from '@element-plus/icons-vue'

const props = defineProps<{
  conversations: ConversationSummary[]
  activeConversationId: string
}>()

const emit = defineEmits<{
  select: [conversationId: string]
  togglePin: [conversationId: string, isPinned: boolean]
  rename: [conversationId: string, title: string]
  delete: [conversationId: string]
}>()

const openMenuId = ref('')
const renamingId = ref('')
const renamingTitle = ref('')
const renameInput = ref<HTMLInputElement>()

function toggleMenu(conversationId: string) {
  openMenuId.value = openMenuId.value === conversationId ? '' : conversationId
}

function closeMenu() {
  openMenuId.value = ''
}

function onTogglePin(conversation: ConversationSummary) {
  closeMenu()
  emit('togglePin', conversation.id, !conversation.isPinned)
}

function startRename(conversation: ConversationSummary) {
  closeMenu()
  renamingId.value = conversation.id
  renamingTitle.value = conversation.title
  nextTick(() => {
    renameInput.value?.focus()
    renameInput.value?.select()
  })
}

function submitRename() {
  const title = renamingTitle.value.trim()
  if (!title) return
  emit('rename', renamingId.value, title)
  renamingId.value = ''
  renamingTitle.value = ''
}

function cancelRename() {
  renamingId.value = ''
  renamingTitle.value = ''
}

async function onDelete(conversation: ConversationSummary) {
  closeMenu()
  await ElMessageBox.confirm('确定要删除这个会话吗？', '删除会话', {
    confirmButtonText: '删除',
    cancelButtonText: '取消',
    type: 'warning'
  })
  emit('delete', conversation.id)
}
</script>

<template>
  <div class="conversation-list">
    <div class="conversation-list-scroll">
      <template v-if="conversations.length > 0">
        <div
          v-for="conversation in conversations"
          :key="conversation.id"
          class="conversation-item"
          :class="{ 'conversation-item--active': conversation.id === activeConversationId }"
          @click="renamingId !== conversation.id && $emit('select', conversation.id)"
        >
          <div class="conversation-item-left">
            <div class="conversation-item-title-row">
              <span v-if="conversation.isPinned" class="conversation-item-pin-tag">已置顶</span>
              <template v-if="renamingId === conversation.id">
                <input
                  v-model="renamingTitle"
                  class="conversation-item-rename-input"
                  @keyup.enter="submitRename"
                  @keyup.escape="cancelRename"
                  @blur="submitRename"
                  @click.stop
                  ref="renameInput"
                />
              </template>
              <span v-else class="conversation-item-title">{{ conversation.title }}</span>
            </div>
            <span class="conversation-item-preview">{{
              conversation.lastMessagePreview || '暂无消息'
            }}</span>
          </div>
          <div class="conversation-item-right" @click.stop>
            <el-button
              :icon="MoreFilled"
              text
              size="small"
              @click="toggleMenu(conversation.id)"
            ></el-button>
            <div
              v-if="openMenuId === conversation.id"
              class="conversation-item-menu"
            >
              <button class="conversation-item-menu-item" @click="onTogglePin(conversation)">
                {{ conversation.isPinned ? '取消置顶' : '置顶' }}
              </button>
              <button class="conversation-item-menu-item" @click="startRename(conversation)">
                重命名
              </button>
              <button class="conversation-item-menu-item conversation-item-menu-item--danger" @click="onDelete(conversation)">
                删除
              </button>
            </div>
          </div>
        </div>
      </template>
      <div v-else class="conversation-list-empty">没有匹配的会话</div>
    </div>
  </div>
</template>

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
  overflow: visible;
  background: rgba(18, 52, 88, 0.08);

  &-left {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
    overflow: hidden;
  }

  &-title-row {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  &-right {
    display: none;
    margin-left: 12px;
    position: relative;
    flex-shrink: 0;

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

  &-rename-input {
    flex: 1;
    min-width: 0;
    padding: 4px 8px;
    border: 1px solid rgba(18, 52, 88, 0.2);
    border-radius: 8px;
    font-family: inherit;
    font-size: 14px;
    font-weight: 600;
    outline: none;
    background: rgba(255, 255, 255, 0.6);

    &:focus {
      border-color: #123458;
    }
  }

  &-menu {
    position: absolute;
    top: 100%;
    right: 0;
    z-index: 10;
    min-width: 120px;
    padding: 4px;
    border-radius: 12px;
    background: #fff;
    box-shadow: 0 4px 20px rgba(18, 52, 88, 0.2);
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  &-menu-item {
    all: unset;
    padding: 8px 14px;
    border-radius: 8px;
    font-size: 13px;
    cursor: pointer;
    color: #324155;

    &:hover {
      background: rgba(18, 52, 88, 0.06);
    }

    &--danger {
      color: #e74c3c;

      &:hover {
        background: rgba(231, 76, 60, 0.08);
      }
    }
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
