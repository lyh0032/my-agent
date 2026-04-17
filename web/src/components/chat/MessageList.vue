<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Message } from '../../types/chat'
import {
  extractMarkdownImages,
  renderMarkdown,
  stripMarkdownImages,
  type MarkdownImageAsset
} from '../../utils/markdown'
import { dayjs } from 'element-plus'

const props = defineProps<{
  messages: Message[]
  streaming?: boolean
  thinkingText?: string
}>()

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
  return renderMarkdown(stripMarkdownImages(message.content))
}

function getMessageImages(message: Message) {
  return extractMarkdownImages(message.content)
}

function openImagePreview(image: MarkdownImageAsset, message: Message, index: number) {
  previewImage.value = {
    image,
    fileName: buildImageFileName(message, index)
  }
}

function closeImagePreview() {
  previewImage.value = null
}

function buildImageFileName(message: Message, index: number) {
  return `generated-${message.id}-${index + 1}.png`
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
      <div
        v-if="message.role !== 'user' ? renderedContent(message) : message.content"
        class="message-bubble-content"
        v-html="
          message.role !== 'user'
            ? renderedContent(message)
            : `<div style='white-space: pre-wrap;'>${message.content}</div>`
        "
      ></div>
      <div v-if="getMessageImages(message).length > 0" class="message-bubble-gallery">
        <figure
          v-for="(image, index) in getMessageImages(message)"
          :key="`${message.id}-${image.url}-${index}`"
          class="message-bubble-gallery-card"
        >
          <button
            class="message-bubble-gallery-trigger"
            type="button"
            @click="openImagePreview(image, message, index)"
          >
            <img :src="image.url" :alt="image.alt || '生成图片'" loading="lazy" />
          </button>
          <figcaption class="message-bubble-gallery-caption">
            {{ image.alt || image.title || '生成图片' }}
          </figcaption>
          <div class="message-bubble-gallery-actions">
            <button type="button" @click="openImagePreview(image, message, index)">预览</button>
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
      <span class="message-bubble-role">
        {{ roleLabelMap.assistant }}
        <span class="message-bubble-time">思考中...</span>
      </span>
      <div class="message-bubble-thinking">
        <span class="message-bubble-thinking-text">{{ props.thinkingText || '正在整理回答' }}</span>
        <span class="message-bubble-thinking-dots" aria-hidden="true">
          <i></i>
          <i></i>
          <i></i>
        </span>
      </div>
    </article>

    <el-dialog
      :model-value="Boolean(previewImage)"
      width="min(92vw, 960px)"
      top="6vh"
      append-to-body
      destroy-on-close
      @close="closeImagePreview"
    >
      <div v-if="previewImage" class="message-preview-dialog">
        <img :src="previewImage.image.url" :alt="previewImage.image.alt || '生成图片预览'" />
        <div class="message-preview-dialog-actions">
          <button type="button" @click="closeImagePreview">关闭</button>
          <a
            :href="previewImage.image.url"
            :download="previewImage.fileName"
            target="_blank"
            rel="noopener noreferrer"
          >
            下载图片
          </a>
        </div>
      </div>
    </el-dialog>
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

  &-gallery-trigger {
    width: 100%;
    padding: 0;
    border: 0;
    background: transparent;
    cursor: zoom-in;

    img {
      width: 100%;
      aspect-ratio: 1 / 1;
      object-fit: cover;
      display: block;
      border-radius: 12px;
      background: rgba(18, 52, 88, 0.08);
    }
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

    button:last-child {
      background: rgba(18, 52, 88, 0.12);
      color: #123458;
    }
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
    gap: 10px;
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

.message-preview-dialog {
  display: grid;
  gap: 16px;

  img {
    width: 100%;
    max-height: 76vh;
    object-fit: contain;
    border-radius: 18px;
    background: rgba(18, 52, 88, 0.06);
  }

  &-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;

    button,
    a {
      min-width: 104px;
      height: 40px;
      border: 0;
      border-radius: 12px;
      background: #123458;
      color: #fff;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      text-decoration: none;
    }

    button:first-child {
      background: rgba(18, 52, 88, 0.12);
      color: #123458;
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
