<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Message, StreamAssistantStatus } from '../../types/chat'
import {
  extractMarkdownImages,
  renderMarkdownWithoutFileLinks,
  type MarkdownImageAsset
} from '../../utils/markdown'
import { dayjs } from 'element-plus'

const props = defineProps<{
  messages: Message[]
  streaming?: boolean
  thinkingText?: string
  streamingStatus?: StreamAssistantStatus | null
}>()

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
  <div v-if="messages.length === 0" class="message-empty">
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
      <div
        v-if="showMessageContent(message)"
        class="message-bubble-content"
        v-html="
          message.role !== 'user'
            ? renderedContent(message)
            : `<div style='white-space: pre-wrap;'>${message.content}</div>`
        "
      ></div>
      <div v-if="showMessageStatusPlaceholder(message)" class="message-bubble-status-placeholder">
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
  color: #5f6774;
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
  max-width: 760px;
  max-width: 100%;
  padding: 16px 18px;
  border-radius: 20px;
  background: #d3e5ff;
  color: #142235;

  &--user {
    margin-left: auto;
    background: #123458;
    color: #fff;
  }

  &--assistant {
    margin-right: auto;
  }

  &--thinking {
    min-width: 220px;
  }

  &--system {
    margin: 0 auto;
    background: #fff2cf;
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
    color: #888888;
    font-size: 10px;
  }

  &-status {
    margin-left: 8px;
    color: #8c5c2a;
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
      border-left: 4px solid rgba(18, 52, 88, 0.18);
      background: rgba(18, 52, 88, 0.05);
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
      background: rgba(18, 52, 88, 0.08);
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
      border: 1px solid rgba(18, 52, 88, 0.14);
      text-align: left;
      vertical-align: top;
    }

    :deep(th) {
      background: rgba(18, 52, 88, 0.06);
      font-weight: 700;
    }

    :deep(hr) {
      margin: 1em 0;
      border: 0;
      border-top: 1px solid rgba(18, 52, 88, 0.16);
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
    background: rgba(255, 255, 255, 0.56);
    border: 1px solid rgba(18, 52, 88, 0.12);
  }

  &-gallery-img {
    width: 100%;
    aspect-ratio: 1 / 1;
    object-fit: cover;
    display: block;
    border-radius: 12px;
    background: rgba(18, 52, 88, 0.08);
  }

  &-gallery-caption {
    margin-top: 8px;
    font-size: 13px;
    color: #324155;
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
      background: #123458;
      color: #fff;
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
    color: #324155;
  }

  &-status-placeholder {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    min-height: 28px;
    color: #324155;
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
      background: rgba(18, 52, 88, 0.12);
      color: #123458;
    }

    &--search {
      background: rgba(20, 115, 92, 0.14);
      color: #0e6b58;
    }

    &--image {
      background: rgba(140, 92, 42, 0.16);
      color: #8c5c2a;
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
}

@keyframes blink {
  50% {
    opacity: 0;
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
