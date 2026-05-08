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

const visiblePopoverId = ref('')
const renamePopoverId = ref('')
const renameTitle = ref('')

function closePopover() {
  visiblePopoverId.value = ''
}

function onTogglePin(conversation: ConversationSummary) {
  closePopover()
  emit('togglePin', conversation.id, !conversation.isPinned)
}

function startRename(conversation: ConversationSummary) {
  closePopover()
  renamePopoverId.value = conversation.id
  renameTitle.value = conversation.title
  nextTick(() => {
    const el = document.querySelector<HTMLInputElement>('.rename-popover-input')
    el?.focus()
    el?.select()
  })
}

function confirmRename() {
  const title = renameTitle.value.trim()
  if (!title) return
  emit('rename', renamePopoverId.value, title)
  renamePopoverId.value = ''
  renameTitle.value = ''
}

function cancelRename() {
  renamePopoverId.value = ''
  renameTitle.value = ''
}

async function onDelete(conversation: ConversationSummary) {
  closePopover()
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
          @click="renamePopoverId !== conversation.id && $emit('select', conversation.id)"
        >
          <div class="conversation-item-left">
            <div class="conversation-item-title-row">
              <span v-if="conversation.isPinned" class="conversation-item-pin-tag">已置顶</span>
              <span class="conversation-item-title">{{ conversation.title }}</span>
            </div>
            <span class="conversation-item-preview">{{
              conversation.lastMessagePreview || '暂无消息'
            }}</span>
            <ElPopover
              placement="bottom"
              :width="280"
              :show-arrow="false"
              :teleported="true"
              :visible="renamePopoverId === conversation.id"
              popper-style="padding: 0"
              @update:visible="
                (val: boolean) => {
                  if (!val && renamePopoverId === conversation.id) cancelRename()
                }
              "
            >
              <template #reference>
                <span class="rename-popover-reference" />
              </template>
              <div class="rename-popover-content">
                <div class="rename-popover-header">重命名会话</div>
                <input
                  v-model="renameTitle"
                  class="rename-popover-input"
                  placeholder="请输入会话名称"
                  @keyup.enter="confirmRename"
                  @keyup.escape="cancelRename"
                />
                <div class="rename-popover-actions">
                  <el-button size="small" @click="cancelRename">取消</el-button>
                  <el-button size="small" type="primary" @click="confirmRename">确定</el-button>
                </div>
              </div>
            </ElPopover>
          </div>
          <div class="conversation-item-right" @click.stop>
            <ElPopover
              trigger="click"
              placement="bottom-end"
              :width="160"
              :show-arrow="false"
              :hide-after="0"
              :visible="visiblePopoverId === conversation.id"
              :teleported="true"
              :popper-style="{ padding: '4px' }"
              @update:visible="(val: boolean) => (visiblePopoverId = val ? conversation.id : '')"
            >
              <template #reference>
                <el-button :icon="MoreFilled" text size="small"></el-button>
              </template>
              <div class="popover-menu">
                <div class="popover-menu-item" @click="onTogglePin(conversation)">
                  {{ conversation.isPinned ? '取消置顶' : '置顶' }}
                </div>
                <div class="popover-menu-item" @click="startRename(conversation)">重命名</div>
                <div
                  class="popover-menu-item popover-menu-item--danger"
                  @click="onDelete(conversation)"
                >
                  删除
                </div>
              </div>
            </ElPopover>
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
    color: var(--text-secondary);
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
  background: var(--bg-badge);

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
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;

    .el-button {
      padding: 0 6px;
      margin: 0;
    }
  }

  // &:hover {
  //   .conversation-item-right {
  //     display: flex;
  //     align-items: center;
  //     justify-content: center;
  //   }
  // }

  &--active {
    background: var(--bg-active);
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
    color: var(--accent-warm);
    font-size: 12px;
    line-height: 1.4;
  }

  &-preview {
    color: var(--text-secondary);
    font-size: 12px;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

}

.rename-popover-reference {
  pointer-events: none;
}

.rename-popover-content {
  padding: 16px;
}

.rename-popover-header {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 12px;
}

.rename-popover-input {
  display: block;
  box-sizing: border-box;
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--border-medium);
  border-radius: 8px;
  font-family: inherit;
  font-size: 14px;
  outline: none;
  background: var(--bg-input);
  transition: border-color 0.2s;

  &:focus {
    border-color: var(--accent);
  }
}

.rename-popover-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 12px;
}

.popover-menu {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.popover-menu-item {
  padding: 8px 14px;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
  color: var(--text-primary);
  user-select: none;

  &:hover {
    background: var(--bg-hover);
  }

  &--danger {
    color: var(--danger);

    &:hover {
      background: var(--danger-bg);
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
