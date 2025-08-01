<template>
  <div class="executable-code">
    <!-- 代码编辑区域 -->
    <div class="code-editor">
      <textarea
        v-model="code"
        :disabled="isExecuting"
        :class="{ executing: isExecuting }"
      ></textarea>
    </div>

    <!-- 执行按钮 -->
    <div class="code-actions">
      <button @click="executeCode" :disabled="!kernelReady || isExecuting">
        {{ isExecuting ? '执行中...' : '运行' }}
      </button>
      <span v-if="!kernelReady" class="status-message"> 内核未连接 </span>
    </div>

    <!-- 新增：输入区域 -->
<div v-if="isWaitingForInput" class="input-area">
  <input
    ref="inputField"
    v-model="userInput"
    :type="inputPassword ? 'password' : 'text'"
    @keyup.enter="submitInput"
    class="user-input"
    :placeholder="inputPrompt"
    autocomplete="off"
    spellcheck="false"
  />
</div>

    <!-- 输出区域 -->
    <div class="code-output" v-if="outputs.length > 0">
      <div v-for="(output, index) in outputs" :key="index" class="output-item">
        <div v-if="typeof output === 'string'" class="text-output">
          {{ output }}
        </div>
        <div v-else-if="output?.html" class="html-output" v-html="output.html"></div>
        <div v-else-if="output?.image" class="image-output">
          <img :src="output.image" alt="Output image" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import { useThebe } from '../composables/useThebe'

const props = defineProps({
  initialCode: {
    type: String,
    default: '',
  },
})

const code = ref(props.initialCode)
const cellId = ref(`cell-${uuidv4()}`)
const isExecuting = ref(false)
const outputs = ref<any[]>([])

// 输入相关状态
const userInput = ref('')
const inputField = ref<HTMLInputElement>()

const { state, executeCode: runCode, initializeKernel, renderOutput, sendInputReply } = useThebe()

// 计算kernel是否准备好
const kernelReady = computed(() => state.isReady)

// 计算是否在等待输入
const isWaitingForInput = computed(() => {
  const execution = state.cellExecutions.get(cellId.value)
  return execution?.status === 'waiting_for_input'
})

// 获取输入提示信息
const inputPrompt = computed(() => {
  const request = state.inputRequests.get(cellId.value)
  return request?.prompt || '请输入:'
})

// 判断是否是密码输入
const inputPassword = computed(() => {
  const request = state.inputRequests.get(cellId.value)
  return request?.password || false
})

// 获取执行按钮文本
function getExecutionButtonText() {
  if (isWaitingForInput.value) {
    return '等待输入...'
  }
  return isExecuting.value ? '执行中...' : '运行'
}

// 执行代码
async function executeCode() {
  if (!kernelReady.value || isExecuting.value) return

  isExecuting.value = true
  outputs.value = []

  try {
    const result = await runCode(code.value, cellId.value)

    // 处理输出
    if (result?.output) {
      outputs.value = result.output.map((out) => renderOutput(out)).filter(Boolean) // 移除空值
    }
  } catch (error) {
    console.error('执行错误:', error)
    outputs.value = [`错误: ${error}`]
  } finally {
    isExecuting.value = false
  }
}

// 提交用户输入
async function submitInput() {
  if (!userInput.value.trim()) return

  try {
    await sendInputReply(cellId.value, userInput.value)

    // 将输入也显示在输出中（模拟交互式输入的显示效果）
    outputs.value.push(`${inputPrompt.value} ${userInput.value}`)

    // 清空输入框
    userInput.value = ''
  } catch (error) {
    console.error('输入提交错误:', error)
    outputs.value.push(`输入错误: ${error}`)
  }
}

// 监听输入状态变化，自动聚焦输入框
watch(isWaitingForInput, async (waiting) => {
  if (waiting) {
    await nextTick()
    inputField.value?.focus()
  }
})

// 组件挂载时，确保内核已初始化
onMounted(() => {
  if (!state.isReady && !state.isConnecting) {
    initializeKernel()
  }
})
</script>

<style scoped>
.executable-code {
  border: 1px solid #ddd;
  border-radius: 4px;
  margin-bottom: 1rem;
  overflow: hidden;
}

.code-editor {
  position: relative;
}

.code-editor textarea {
  width: 100%;
  min-height: 100px;
  font-family: monospace;
  padding: 0.5rem;
  border: none;
  border-bottom: 1px solid #eee;
  resize: vertical;
  background-color: #f8f8f8;
}

.code-editor textarea.executing {
  background-color: #f0f8ff;
}

/* .code-actions {
  padding: 0.5rem;
  background-color: transparent;
  display: flex;
  align-items: center;
} */

.code-actions button {
  padding: 0.25rem 0.75rem;
  background-color: #4caf50;
  color: white;
  border: none;
  border-radius: 3px;
  cursor: pointer;
}

.code-actions button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

.status-message {
  margin-left: 1rem;
  font-size: 0.85rem;
  color: #666;
}

/* 新增：输入区域样式 */
.input-area {
  padding: 0.5rem 0.5rem 0.5rem 0;
  background: none;
  border: none;
}

.user-input {
  width: 100%;
  font-family: monospace;
  font-size: 1rem;
  padding: 0.25rem 0.5rem;
  border: 1px solid #ccc;
  border-radius: 2px;
  outline: none;
  background: #fff;
  box-sizing: border-box;
  transition: border-color 0.2s;
}

.user-input:focus {
  border-color: #1976d2;
  background: #f7faff;
}

.code-output {
  padding: 0.5rem;
  border-top: 1px solid #eee;
  max-height: 300px;
  overflow: auto;
}

.output-item {
  margin-bottom: 0.5rem;
}

.text-output {
  font-family: monospace;
  white-space: pre-wrap;
}

.html-output {
  overflow: auto;
}

.image-output img {
  max-width: 100%;
}
</style>
