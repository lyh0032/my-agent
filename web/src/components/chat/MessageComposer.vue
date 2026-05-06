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
  audioSubmit: [blob: Blob]
}>()

const content = ref('')
const isRecording = ref(false)
const isUploading = ref(false)
const recordingDuration = ref(0)

let mediaRecorder: MediaRecorder | null = null
let audioChunks: Blob[] = []
let recordingTimer: ReturnType<typeof setInterval> | null = null
let mediaStream: MediaStream | null = null

const canSubmit = computed(() => content.value.trim().length > 0 && props.loading !== true)

const isMediaRecorderSupported = computed(
  () => typeof window !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia)
)

const recordingTimerText = computed(() => {
  const minutes = Math.floor(recordingDuration.value / 60)
  const seconds = recordingDuration.value % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
})

function getRecorderMimeType(): string {
  if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
    return 'audio/webm;codecs=opus'
  }

  if (MediaRecorder.isTypeSupported('audio/webm')) {
    return 'audio/webm'
  }

  if (MediaRecorder.isTypeSupported('audio/mp4')) {
    return 'audio/mp4'
  }

  return 'audio/webm'
}

async function startRecording() {
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true })
    audioChunks = []

    const mimeType = getRecorderMimeType()
    mediaRecorder = new MediaRecorder(mediaStream, mimeType ? { mimeType } : undefined)

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data)
      }
    }

    mediaRecorder.onstop = () => {
      stopMediaTracks()
      submitRecording()
    }

    mediaRecorder.start(250)
    isRecording.value = true

    recordingDuration.value = 0
    recordingTimer = setInterval(() => {
      recordingDuration.value++
    }, 1000)
  } catch {
    ElMessage.error('无法访问麦克风，请在浏览器中允许麦克风权限')
  }
}

function stopMediaTracks() {
  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => track.stop())
    mediaStream = null
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop()
  }

  isRecording.value = false

  if (recordingTimer) {
    clearInterval(recordingTimer)
    recordingTimer = null
  }
}

function submitRecording() {
  if (audioChunks.length === 0) {
    return
  }

  const mimeType = mediaRecorder?.mimeType || 'audio/webm'
  const blob = new Blob(audioChunks, { type: mimeType })
  audioChunks = []

  isUploading.value = true
  emit('audioSubmit', blob)
  isUploading.value = false
}

function toggleRecording() {
  if (props.loading) {
    return
  }

  if (isRecording.value) {
    stopRecording()
    return
  }

  if (!isMediaRecorderSupported.value) {
    ElMessage.warning('当前浏览器不支持录音')
    return
  }

  void startRecording()
}

function handleContentChange(value: string | number) {
  content.value = typeof value === 'string' ? value : String(value)
}

function handleSubmit() {
  const value = content.value.trim()

  if (!value || props.loading) {
    return
  }

  emit('submit', value)
  content.value = ''
}

function handleCancel() {
  emit('cancel')
}

onBeforeUnmount(() => {
  if (isRecording.value) {
    stopRecording()
  }

  if (mediaStream) {
    stopMediaTracks()
  }
})
</script>

<template>
  <div class="composer">
    <el-input
      :model-value="content"
      class="composer-input"
      type="textarea"
      resize="none"
      placeholder="输入问题，回车发送，Shift + 回车换行，聊天消息会自动保存到当前会话"
      :autosize="{ minRows: 2, maxRows: 5 }"
      @update:model-value="handleContentChange"
      @keydown.enter.exact.prevent="handleSubmit"
    />

    <div class="composer-speech-status">
      <template v-if="isRecording">
        <span class="recording-indicator" />
        正在录音 {{ recordingTimerText }}
      </template>
      <template v-else-if="isUploading">
        正在上传语音...
      </template>
    </div>

    <div class="composer-actions">
      <span class="composer-hint">Shift + Enter 换行</span>
      <el-button
        class="composer-mic"
        circle
        :icon="Microphone"
        :type="isRecording ? 'warning' : 'default'"
        :disabled="props.loading || !isMediaRecorderSupported"
        :title="isRecording ? '停止录音' : '开始录音'"
        @click="toggleRecording"
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
    display: flex;
    align-items: center;
    gap: 6px;
    color: #c13e3e;
    font-size: 12px;
    line-height: 1.4;
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

.recording-indicator {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: #c13e3e;
  animation: pulse 1s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.3;
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
