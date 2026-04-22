<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Microphone, Promotion, VideoPause } from '@element-plus/icons-vue'

const props = defineProps<{
  loading?: boolean
  canStop?: boolean
}>()

const emit = defineEmits<{
  submit: [content: string]
  cancel: []
}>()

const content = ref('')
const isListening = ref(false)
const recognitionError = ref('')
const speechDraftBase = ref('')
const speechFinalTranscript = ref('')
const speechInterimTranscript = ref('')

let recognition: SpeechRecognition | null = null

const canSubmit = computed(() => content.value.trim().length > 0 && props.loading !== true)
const isSpeechRecognitionSupported = computed(
  () =>
    typeof window !== 'undefined' &&
    Boolean(window.SpeechRecognition || window.webkitSpeechRecognition)
)
const speechStatusText = computed(() => {
  if (recognitionError.value) {
    return recognitionError.value
  }

  if (isListening.value) {
    return '正在听写，语音内容会实时写入输入框'
  }

  if (!isSpeechRecognitionSupported.value) {
    return '当前浏览器不支持语音识别'
  }

  return ''
})

function getSpeechRecognitionConstructor() {
  if (typeof window === 'undefined') {
    return null
  }

  return window.SpeechRecognition || window.webkitSpeechRecognition || null
}

function mergeDraftContent() {
  const transcript = `${speechFinalTranscript.value}${speechInterimTranscript.value}`.trim()

  if (!speechDraftBase.value) {
    content.value = transcript
    return
  }

  content.value = transcript ? `${speechDraftBase.value}\n${transcript}` : speechDraftBase.value
}

function stopRecognition(clearState = false) {
  if (recognition) {
    recognition.onstart = null
    recognition.onresult = null
    recognition.onerror = null
    recognition.onend = null
    recognition.stop()
    recognition = null
  }

  isListening.value = false

  if (clearState) {
    speechDraftBase.value = ''
    speechFinalTranscript.value = ''
    speechInterimTranscript.value = ''
    recognitionError.value = ''
  }
}

function mapRecognitionError(error: SpeechRecognitionErrorEvent['error']) {
  switch (error) {
    case 'not-allowed':
    case 'service-not-allowed':
      return '没有麦克风权限，请在浏览器中允许访问麦克风'
    case 'audio-capture':
      return '没有检测到可用的麦克风设备'
    case 'network':
      return '语音识别网络异常，请稍后重试'
    case 'no-speech':
      return '没有识别到语音，请再试一次'
    case 'language-not-supported':
      return '当前浏览器不支持中文语音识别'
    default:
      return '语音识别已中断，请重试'
  }
}

function handleContentChange(value: string | number) {
  content.value = typeof value === 'string' ? value : String(value)

  if (!isListening.value) {
    return
  }

  speechDraftBase.value = content.value
  speechFinalTranscript.value = ''
  speechInterimTranscript.value = ''
}

function toggleSpeechRecognition() {
  if (props.loading) {
    return
  }

  if (isListening.value) {
    stopRecognition()
    speechInterimTranscript.value = ''
    mergeDraftContent()
    return
  }

  const RecognitionConstructor = getSpeechRecognitionConstructor()

  if (!RecognitionConstructor) {
    recognitionError.value = '当前浏览器不支持语音识别'
    ElMessage.warning(recognitionError.value)
    return
  }

  recognitionError.value = ''
  speechDraftBase.value = content.value.trimEnd()
  speechFinalTranscript.value = ''
  speechInterimTranscript.value = ''

  const nextRecognition = new RecognitionConstructor()
  nextRecognition.lang = 'zh-CN'
  nextRecognition.continuous = true
  nextRecognition.interimResults = true
  nextRecognition.maxAlternatives = 1

  nextRecognition.onstart = () => {
    isListening.value = true
  }

  nextRecognition.onresult = (event) => {
    let finalTranscript = ''
    let interimTranscript = ''

    for (let index = 0; index < event.results.length; index += 1) {
      const result = event.results[index]
      const transcript = result[0]?.transcript ?? ''

      if (result.isFinal) {
        finalTranscript += transcript
      } else {
        interimTranscript += transcript
      }
    }

    speechFinalTranscript.value = finalTranscript.trim()
    speechInterimTranscript.value = interimTranscript.trim()
    mergeDraftContent()
  }

  nextRecognition.onerror = (event) => {
    recognitionError.value = mapRecognitionError(event.error)
    ElMessage.warning(recognitionError.value)
  }

  nextRecognition.onend = () => {
    recognition = null
    isListening.value = false
    speechInterimTranscript.value = ''
    mergeDraftContent()
  }

  recognition = nextRecognition
  nextRecognition.start()
}

function handleSubmit() {
  const value = content.value.trim()

  if (!value || props.loading) {
    return
  }

  stopRecognition(true)
  emit('submit', value)
  content.value = ''
  speechDraftBase.value = ''
  speechFinalTranscript.value = ''
  speechInterimTranscript.value = ''
  recognitionError.value = ''
}

function handleCancel() {
  emit('cancel')
}

onBeforeUnmount(() => {
  stopRecognition(true)
})
</script>

<template>
  <div class="composer">
    <el-input
      :model-value="content"
      class="composer-input"
      type="textarea"
      resize="none"
      :readonly="isListening"
      placeholder="输入问题，回车发送，Shift + 回车换行，聊天消息会自动保存到当前会话"
      :autosize="{ minRows: 2, maxRows: 5 }"
      @update:model-value="handleContentChange"
      @keydown.enter.exact.prevent="handleSubmit"
    />

    <div
      v-if="speechStatusText"
      class="composer-speech-status"
      :data-error="Boolean(recognitionError)"
    >
      {{ speechStatusText }}
    </div>

    <div class="composer-actions">
      <span class="composer-hint">Shift + Enter 换行</span>
      <el-button
        class="composer-mic"
        circle
        :icon="Microphone"
        :type="isListening ? 'warning' : 'default'"
        :disabled="props.loading || !isSpeechRecognitionSupported"
        :title="isListening ? '停止语音输入' : '开始语音输入'"
        @click="toggleSpeechRecognition"
      />
      <el-button
        v-if="canStop"
        class="composer-stop"
        type="danger"
        circle
        :icon="VideoPause"
        @click="handleCancel"
      />
      <el-button
        v-else
        class="composer-send"
        type="primary"
        circle
        :icon="Promotion"
        :disabled="!canSubmit"
        @click="handleSubmit"
      />
    </div>
  </div>
</template>

<style scoped lang="less">
.composer {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 120px;
  overflow: hidden;
  padding: 16px;
  border: 1px solid rgba(18, 52, 88, 0.12);
  border-radius: 28px;
  box-shadow:
    0 18px 40px rgba(18, 52, 88, 0.08),
    0 6px 14px rgba(18, 52, 88, 0.05);
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    transform 0.2s ease;

  &:focus-within {
    border-color: rgba(18, 52, 88, 0.22);
    box-shadow:
      0 22px 48px rgba(18, 52, 88, 0.12),
      0 0 0 4px rgba(18, 52, 88, 0.06);
    transform: translateY(-1px);
  }

  &-input {
    display: block;
    flex: 1;
    width: 100%;

    :deep(.el-textarea) {
      display: block;
    }

    :deep(.el-textarea__inner) {
      min-height: 0 !important;
      padding: 0;
      border-radius: 0;
      background: transparent;
      box-shadow: none;
      border: none !important;
      color: #142235;
      line-height: 1.7;
      font-size: 15px;

      &::placeholder {
        color: #8f99a8;
      }
    }
  }

  &-actions {
    display: flex;
    align-items: center;
    gap: 10px;
    justify-content: flex-end;
  }

  &-speech-status {
    color: #6b7686;
    font-size: 12px;
    line-height: 1.4;

    &[data-error='true'] {
      color: #c13e3e;
    }
  }

  &-hint {
    color: #7c8798;
    font-size: 12px;
    line-height: 1;
    user-select: none;
  }

  &-send {
    border: 0;
    box-shadow: 0 10px 20px rgba(18, 52, 88, 0.2);

    &:not(.is-disabled) {
      background: linear-gradient(135deg, #123458 0%, #275d90 100%);
    }

    &.is-disabled {
      box-shadow: none;
      background: #d7dce4;
    }

    :deep(.el-icon) {
      font-size: 16px;
    }
  }

  &-mic {
    border: 1px solid rgba(18, 52, 88, 0.14);
    color: #123458;

    &.el-button--warning {
      border: 0;
      box-shadow: 0 10px 20px rgba(212, 128, 36, 0.2);
    }
  }

  &-stop {
    border: 0;
    box-shadow: 0 10px 20px rgba(193, 62, 62, 0.18);
  }
}

@media (max-width: 640px) {
  .composer {
    min-height: 120px;
    padding: 16px;
    border-radius: 24px;

    &-actions {
      right: 14px;
      bottom: 12px;
    }

    &-hint {
      display: none;
    }
  }
}
</style>
