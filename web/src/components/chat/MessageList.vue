<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Message, StreamAssistantStatus } from '../../types/chat'
import {
  extractMarkdownImages,
  renderMarkdownWithoutFileLinks,
  type MarkdownImageAsset
} from '../../utils/markdown'
import { dayjs, ElMessage, ElMessageBox } from 'element-plus'
import { EditPen, Delete } from '@element-plus/icons-vue'

const props = defineProps<{
  messages: Message[]
  loading?: boolean
  streaming?: boolean
  thinkingText?: string
  streamingStatus?: StreamAssistantStatus | null
}>()

const emit = defineEmits<{
  edit: [messageId: string, content: string]
  delete: [messageId: string]
}>()

const editingMessageId = ref('')
const editingContent = ref('')

function startEdit(message: Message) {
  editingMessageId.value = message.id
  editingContent.value = message.content
}

function cancelEdit() {
  editingMessageId.value = ''
  editingContent.value = ''
}

function saveEdit() {
  const content = editingContent.value.trim()
  if (!content) {
    ElMessage.warning('消息内容不能为空')
    return
  }
  emit('edit', editingMessageId.value, content)
  editingMessageId.value = ''
  editingContent.value = ''
}

async function handleDelete(message: Message) {
  await ElMessageBox.confirm('确定要删除这条消息吗？', '删除消息', {
    confirmButtonText: '删除',
    cancelButtonText: '取消',
    type: 'warning'
  })
  emit('delete', message.id)
}

function canEdit(message: Message) {
  if (message.role !== 'user' || message.status !== 'completed') return false
  const lastUserMessage = [...props.messages].reverse().find((m) => m.role === 'user')
  return lastUserMessage?.id === message.id
}

function canDelete(message: Message) {
  return message.status !== 'generating'
}

const toolStatusMetaMap: Record<string, { label: string; tone: 'tool' | 'search' | 'image' }> = {
  webSearchTool: {
    label: '联网检索',
    tone: 'search'
  },
  drawImageTool: {
    label: '图片生成',
    tone: 'image'
  }
}

const roleLabelMap = {
  user: '你',
  assistant: '助手',
  system: '系统'
} as const

const messageStatusLabelMap = {
  generating: '生成中',
  cancelled: '已停止',
  failed: '已失败',
  completed: '已完成'
} as const

function showStreamingCursor(message: Message) {
  return (
    props.streaming === true &&
    message.role === 'assistant' &&
    message.status === 'generating' &&
    props.messages[props.messages.length - 1]?.id === message.id
  )
}

const showThinkingBubble = computed(() => {
  if (props.streaming !== true || props.messages.length === 0) {
    return false
  }

  return props.messages[props.messages.length - 1]?.role !== 'assistant'
})

const previewImage = ref<{
  image: MarkdownImageAsset
  fileName: string
} | null>(null)

function renderedContent(message: Message) {
  return renderMarkdownWithoutFileLinks(message.content, message.fileList)
}

function getMessageImages(message: Message) {
  const imageFiles = message.fileList.filter((file) => file.kind === 'image')

  if (imageFiles.length > 0) {
    return imageFiles.map((file) => ({
      ...file,
      alt: file.name,
      title: file.name
    }))
  }

  return extractMarkdownImages(message.content)
}

const activeToolMeta = computed(() => {
  const toolName = props.streamingStatus?.toolName

  if (!toolName) {
    return null
  }

  return (
    toolStatusMetaMap[toolName] ?? {
      label: toolName,
      tone: 'tool' as const
    }
  )
})

function buildImageFileName(message: Message, index: number) {
  const image = getMessageImages(message)[index]
  const extension = image?.url.split('.').pop()?.split('?')[0] || 'png'
  return `generated-${message.id}-${index + 1}.${extension}`
}

function downloadImage(image: MarkdownImageAsset, message: Message, index: number) {
  const anchor = document.createElement('a')
  anchor.href = image.url
  anchor.download = buildImageFileName(message, index)
  anchor.target = '_blank'
  anchor.rel = 'noopener noreferrer'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}

function isLatestGeneratingAssistantMessage(message: Message) {
  return (
    props.streaming === true &&
    message.role === 'assistant' &&
    message.status === 'generating' &&
    props.messages[props.messages.length - 1]?.id === message.id
  )
}

function showToolStatusInMessage(message: Message) {
  return isLatestGeneratingAssistantMessage(message) && Boolean(props.streamingStatus)
}

function showInlineStatus(message: Message) {
  return (
    showToolStatusInMessage(message) &&
    (Boolean(activeToolMeta.value) || showMessageContent(message))
  )
}

function showInlineStatusText(message: Message) {
  return showToolStatusInMessage(message) && showMessageContent(message)
}

function showMessageContent(message: Message) {
  if (message.role === 'user') {
    return Boolean(message.content)
  }

  return Boolean(renderedContent(message))
}

function showMessageStatusPlaceholder(message: Message) {
  return (
    showToolStatusInMessage(message) &&
    !showMessageContent(message) &&
    getMessageImages(message).length === 0
  )
}
</script>

<template>
  <div v-if="loading" class="message-list">
    <el-skeleton animated :count="3">
      <template #template>
        <div style="display: flex; gap: 12px; padding: 16px 18px">
          <el-skeleton-item variant="circle" style="width: 32px; height: 32px" />
          <div style="flex: 1">
            <el-skeleton-item variant="text" style="width: 30%; margin-bottom: 10px" />
            <el-skeleton-item variant="text" style="width: 60%; margin-bottom: 10px" />
            <el-skeleton-item variant="text" style="width: 85%" />
          </div>
        </div>
      </template>
    </el-skeleton>
  </div>
  <div v-else-if="messages.length === 0" class="message-empty">
    <h3>开始一段新对话</h3>
    <p>输入你的问题，系统会保存会话和消息历史。</p>
  </div>
  <div v-else class="message-list">
      <article
        v-for="message in messages"
        :key="message.id"
        class="message-bubble"
        :class="`message-bubble--${message.role}`"
      >
        <span class="message-bubble-role">
          {{ roleLabelMap[message.role] }}
          <span class="message-bubble-time">{{
            dayjs(message.createdAt).format('YYYY-MM-DD HH:mm:ss')
          }}</span>
          <span
            v-if="message.role === 'assistant' && message.status !== 'completed'"
            class="message-bubble-status"
          >
            {{ messageStatusLabelMap[message.status] }}
          </span>
        </span>
        <div v-if="editingMessageId !== message.id" class="message-bubble-actions">
          <button
            v-if="canEdit(message)"
            class="message-bubble-action-btn"
            title="编辑"
            @click="startEdit(message)"
          >
            <el-icon><EditPen /></el-icon>
          </button>
          <button
            v-if="canDelete(message)"
            class="message-bubble-action-btn"
            title="删除"
            @click="handleDelete(message)"
          >
            <el-icon><Delete /></el-icon>
          </button>
        </div>
        <div v-if="showInlineStatus(message)" class="message-bubble-inline-status">
          <span
            v-if="activeToolMeta"
            class="message-bubble-tool-chip"
            :class="`message-bubble-tool-chip--${activeToolMeta.tone}`"
          >
            调用{{ activeToolMeta.label }}工具中
          </span>
          <span v-if="showInlineStatusText(message)" class="message-bubble-inline-status-text">
            {{ props.streamingStatus?.text }}
          </span>
        </div>
        <template v-if="editingMessageId === message.id">
          <textarea
            v-model="editingContent"
            class="message-bubble-edit-textarea"
            rows="4"
          ></textarea>
          <div class="message-bubble-edit-actions">
            <el-button size="small" type="primary" @click="saveEdit">保存</el-button>
            <el-button size="small" @click="cancelEdit">取消</el-button>
          </div>
        </template>
        <template v-else>
          <div
            v-if="showMessageContent(message)"
            class="message-bubble-content"
            v-html="
              message.role !== 'user'
                ? renderedContent(message)
                : `<div style='white-space: pre-wrap;'>${message.content}</div>`
            "
          ></div>
          <div
            v-if="showMessageStatusPlaceholder(message)"
            class="message-bubble-status-placeholder"
          >
            <span class="message-bubble-status-placeholder-text">{{
              props.streamingStatus?.text
            }}</span>
            <span class="message-bubble-thinking-dots" aria-hidden="true">
              <i></i>
              <i></i>
              <i></i>
            </span>
          </div>
          <div v-if="getMessageImages(message).length > 0" class="message-bubble-gallery">
            <figure
              v-for="(image, index) in getMessageImages(message)"
              :key="`${message.id}-${image.url}-${index}`"
              class="message-bubble-gallery-card"
            >
              <img
                class="message-bubble-gallery-img"
                :src="image.url"
                :alt="image.alt || '生成图片'"
                loading="lazy"
              />
              <figcaption class="message-bubble-gallery-caption">
                {{ image.alt || image.title || '生成图片' }}
              </figcaption>
              <div class="message-bubble-gallery-actions">
                <button type="button" @click="downloadImage(image, message, index)">下载</button>
              </div>
            </figure>
          </div>
          <span v-if="showStreamingCursor(message)" class="message-bubble-cursor"></span>
        </template>
      </article>
    <article
      v-if="showThinkingBubble"
      class="message-bubble message-bubble--assistant message-bubble--thinking"
      aria-live="polite"
      aria-busy="true"
    >
      <span class="message-bubble-role">{{ roleLabelMap.assistant }}</span>
      <div class="message-bubble-thinking">
        <span class="message-bubble-thinking-text">{{ props.thinkingText || '正在整理回答' }}</span>
        <span class="message-bubble-thinking-dots" aria-hidden="true">
          <i></i>
          <i></i>
          <i></i>
        </span>
      </div>
    </article>
  </div>
</template>

<style scoped lang="less">
.message-empty {
  display: flex;
  flex-direction: column;
  text-align: center;
  color: var(--text-secondary);
  position: absolute;
  width: 100%;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.message-list {
  width: 100%;
  min-height: 100%;
  overflow: visible;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.message-bubble {
  position: relative;
  max-width: 760px;
  max-width: 100%;
  padding: 16px 18px;
  border-radius: 20px;
  background: var(--bg-assistant-msg);
  color: var(--text-primary);

  &--user {
    margin-left: auto;
    background: var(--bg-user-msg);
    color: var(--text-inverse);
  }

  &--assistant {
    margin-right: auto;
  }

  &--thinking {
    min-width: 220px;
  }

  &--system {
    margin: 0 auto;
    background: var(--bg-system-msg);
  }

  &-role {
    display: block;
    margin-bottom: 8px;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    user-select: none;
  }

  &-time {
    color: var(--text-secondary);
    font-size: 10px;
  }

  &-status {
    margin-left: 8px;
    color: var(--accent-warm);
    font-size: 10px;
  }

  &-content {
    line-height: 1.7;
    overflow-wrap: anywhere;

    :deep(:first-child) {
      margin-top: 0;
    }

    :deep(:last-child) {
      margin-bottom: 0;
    }

    :deep(p) {
      margin: 0 0 0.85em;
    }

    :deep(ul),
    :deep(ol) {
      margin: 0 0 0.85em;
      padding-left: 1.5em;
    }

    :deep(li + li) {
      margin-top: 0.35em;
    }

    :deep(blockquote) {
      margin: 0 0 0.85em;
      padding: 0.75em 1em;
      border-left: 4px solid var(--border-color);
      background: var(--bg-blockquote);
      border-radius: 0 12px 12px 0;
    }

    :deep(pre) {
      margin: 0 0 0.85em;
      padding: 14px 16px;
      overflow-x: auto;
      border-radius: 14px;
      background: rgba(12, 23, 40, 0.92);
      color: #f5f7fa;
    }

    :deep(code) {
      padding: 0.15em 0.35em;
      border-radius: 6px;
      background: var(--bg-code-inline);
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
      font-size: 0.95em;
    }

    :deep(pre code) {
      padding: 0;
      border-radius: 0;
      background: transparent;
      color: inherit;
      font-size: 0.92em;
    }

    :deep(table) {
      display: block;
      width: 100%;
      margin: 0 0 0.85em;
      overflow-x: auto;
      border-collapse: collapse;
    }

    :deep(th),
    :deep(td) {
      padding: 10px 12px;
      border: 1px solid var(--border-color);
      text-align: left;
      vertical-align: top;
    }

    :deep(th) {
      background: var(--bg-table-hdr);
      font-weight: 700;
    }

    :deep(hr) {
      margin: 1em 0;
      border: 0;
      border-top: 1px solid var(--border-color);
    }

    :deep(a) {
      color: inherit;
      text-decoration: underline;
      text-underline-offset: 2px;
    }
  }

  &-gallery {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 12px;
    margin-top: 14px;
  }

  &-gallery-card {
    margin: 0;
    padding: 10px;
    border-radius: 16px;
    background: var(--bg-gallery);
    border: 1px solid var(--border-color);
  }

  &-gallery-img {
    width: 100%;
    aspect-ratio: 1 / 1;
    object-fit: cover;
    display: block;
    border-radius: 12px;
    background: var(--bg-badge);
  }

  &-gallery-caption {
    margin-top: 8px;
    font-size: 13px;
    color: var(--text-primary);
  }

  &-gallery-actions {
    display: flex;
    gap: 8px;
    margin-top: 10px;

    button {
      flex: 1;
      height: 36px;
      border: 0;
      border-radius: 10px;
      background: var(--accent);
      color: var(--text-inverse);
      cursor: pointer;
    }
  }

  &-inline-status {
    display: inline-flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
    margin-bottom: 10px;
  }

  &-inline-status-text {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
  }

  &-status-placeholder {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    min-height: 28px;
    color: var(--text-primary);
  }

  &-status-placeholder-text {
    font-size: 14px;
    font-weight: 600;
  }

  &-cursor {
    display: inline-block;
    width: 0.7ch;
    height: 1.1em;
    margin-left: 2px;
    transform: translateY(2px);
    background: currentColor;
    animation: blink 1s steps(1) infinite;
  }

  &-thinking {
    display: inline-flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
  }

  &-tool-chip {
    display: inline-flex;
    align-items: center;
    height: 26px;
    padding: 0 10px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.04em;

    &--tool {
      background: var(--bg-chip-tool);
      color: var(--color-chip-tool);
    }

    &--search {
      background: var(--bg-chip-search);
      color: var(--color-chip-search);
    }

    &--image {
      background: var(--bg-chip-image);
      color: var(--color-chip-image);
    }
  }

  &-thinking-text {
    font-size: 14px;
    font-weight: 600;
    letter-spacing: 0.02em;
  }

  &-thinking-dots {
    display: inline-flex;
    align-items: center;
    gap: 6px;

    i {
      width: 8px;
      height: 8px;
      border-radius: 999px;
      background: currentColor;
      opacity: 0.35;
      animation: pulse 1.2s ease-in-out infinite;

      &:nth-child(2) {
        animation-delay: 0.15s;
      }

      &:nth-child(3) {
        animation-delay: 0.3s;
      }
    }
  }

  &-actions {
    position: absolute;
    top: 8px;
    right: 8px;
    display: none;
    gap: 4px;
  }

  &:hover &-actions {
    display: flex;
  }

  &-action-btn {
    width: 28px;
    height: 28px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    background: var(--bg-element);
    color: var(--text-secondary);
    cursor: pointer;
    font-size: 14px;
    padding: 0;

    &:hover {
      background: var(--bg-surface);
      color: var(--accent);
    }
  }

  &-edit-textarea {
    width: 100%;
    padding: 10px;
    border: 1px solid var(--border-medium);
    border-radius: 10px;
    font-family: inherit;
    font-size: 14px;
    line-height: 1.6;
    resize: vertical;
    background: var(--bg-input);
    color: inherit;
    outline: none;
    box-sizing: border-box;

    &:focus {
      border-color: var(--accent);
    }
  }

  &-edit-actions {
    display: flex;
    gap: 8px;
    margin-top: 8px;
  }
}

@keyframes blink {
  50% {
    opacity: 0;
  }
}

@media (hover: none), (max-width: 960px) {
  .message-bubble-actions {
    display: flex;
  }
}

@keyframes pulse {
  0%,
  80%,
  100% {
    transform: translateY(0);
    opacity: 0.35;
  }

  40% {
    transform: translateY(-3px);
    opacity: 1;
  }
}
</style>
