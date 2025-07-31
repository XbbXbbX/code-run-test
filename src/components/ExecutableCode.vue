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
import { ref, computed, onMounted } from 'vue'
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

const { state, executeCode: runCode, initializeKernel, renderOutput } = useThebe()

// 计算kernel是否准备好
const kernelReady = computed(() => state.isReady)

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
