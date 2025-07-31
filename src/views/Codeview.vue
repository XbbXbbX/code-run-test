<template>
  <div class="thebe-demo">
    <h1>Thebe + BinderHub 演示</h1>

    <div class="kernel-status">
      状态: {{ state.kernelStatus }}
      <button v-if="!state.isReady" @click="connectKernel" :disabled="state.isConnecting">
        {{ state.isConnecting ? '连接中...' : '连接 Kernel' }}
      </button>
      <button v-else @click="disconnect">断开连接</button>
    </div>

    <div class="examples">
      <h2>Python 示例</h2>
      <ExecutableCode initial-code="print('Hello, World!')" />

      <h2>数据可视化示例</h2>
      <ExecutableCode :initial-code="matplotlibExample" />

      <h2>交互式小部件示例</h2>
      <ExecutableCode :initial-code="ipywidgetsExample" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useThebe } from '../composables/useThebe'
import ExecutableCode from '../components/ExecutableCode.vue'

const { state, initializeKernel, disconnect } = useThebe()

// 连接到内核
function connectKernel() {
  initializeKernel({
    kernelOptions: {
      kernelName: 'python3',
    },
    binderOptions: {
      repo: 'binder-examples/matplotlib-versions',
      ref: 'matplotlib-2.1.2',
      binderUrl: 'https://mybinder.org',
      repoProvider: 'github',
    },
  })
}

// 示例代码
const matplotlibExample = `import matplotlib.pyplot as plt
import numpy as np

x = np.linspace(0, 10, 100)
y = np.sin(x)

plt.figure(figsize=(8, 4))
plt.plot(x, y)
plt.title('Sine Wave')
plt.grid(True)
plt.show()`

const ipywidgetsExample = `import ipywidgets as widgets
from IPython.display import display

slider = widgets.IntSlider(
    value=10,
    min=0,
    max=100,
    step=1,
    description='Value:',
    continuous_update=False
)

output = widgets.Output()

def on_value_change(change):
    with output:
        output.clear_output()
        print(f"Slider value: {change['new']}")

slider.observe(on_value_change, names='value')

display(slider)
display(output)`

// 自动连接内核
onMounted(() => {
  connectKernel()
})
</script>

<style scoped>
.thebe-demo {
  max-width: 800px;
  margin: 0 auto;
  padding: 1rem;
}

.kernel-status {
  margin-bottom: 2rem;
  padding: 1rem;
  background-color: #f5f5f5;
  border-radius: 4px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.examples {
  margin-top: 2rem;
}

h1 {
  margin-bottom: 2rem;
  color: #333;
}

h2 {
  margin-top: 2rem;
  margin-bottom: 1rem;
  color: #444;
}

button {
  padding: 0.5rem 1rem;
  background-color: #2196f3;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

button:disabled {
  background-color: #cccccc;
}
</style>
