<template>
  <div class="thebe-demo">
    <h1>Thebe演示</h1>

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

      <h2>状态延续小部件示例</h2>
      <ExecutableCode :initial-code="ipywidgetsExample" />

      <h2>多步骤交互示例</h2>
      <ExecutableCode :initial-code="multiInputExample" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useThebe } from '../composables/useThebe'
import ExecutableCode from '../components/ExecutableCode.vue'

const { state, initializeKernel, disconnect } = useThebe()

// 连接到内核
function connectKernel() {
  const uniqueSuffix = Date.now().toString(36) + Math.random().toString(36).substring(2)
  initializeKernel({
    kernelOptions: {
      kernelName: 'python3',
      path: uniqueSuffix,
    },
    // binderOptions: {
    //111222
    //   repo: 'binder-examples/matplotlib-versions',
    //   ref: 'matplotlib-2.1.2',
    //   binderUrl: 'https://mybinder.org',
    //   repoProvider: 'github',
    // },
    serverSettings: {
      baseUrl: 'http://106.15.43.196:12346', // Gateway URL
      token: '112233', // Gateway 令牌
      appendToken: false,
      // wsUrl: 'ws://your-jupyter-gateway-url:8888', // 可选: 如果 WebSocket URL 不同，可显式定义
    },
    savedSessionOptions: {
      enabled: false,
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
plt.show()
a = 1`

const multiInputExample = `# 多步骤交互示例
print("欢迎使用简单计算器！")

num1 = float(input("请输入第一个数字: "))
num2 = float(input("请输入第二个数字: "))
operation = input("请选择运算 (+, -, *, /): ")

if operation == '+':
    result = num1 + num2
elif operation == '-':
    result = num1 - num2
elif operation == '*':
    result = num1 * num2
elif operation == '/':
    if num2 != 0:
        result = num1 / num2
    else:
        result = "错误：除数不能为零"
else:
    result = "错误：不支持的运算符"

print(f"结果: {result}")`

// const ipywidgetsExample = `import ipywidgets as widgets
// from IPython.display import display

// slider = widgets.IntSlider(
//     value=10,
//     min=0,
//     max=100,
//     step=1,
//     description='Value:',
//     continuous_update=False
// )

// output = widgets.Output()

// def on_value_change(change):
//     with output:
//         output.clear_output()
//         print(f"Slider value: {change['new']}")

// slider.observe(on_value_change, names='value')

// display(slider)
// display(output)`

// const ipywidgetsExample = `# 输出第一部分
// print("欢迎使用简单计算器！")
// print(f"a = {a}")
// # 输入
// num = input("请输入一个数字: ")

// # 输出第二部分（包含输入的结果）
// print(f"您输入的数字是: {num}")
// print("计算完成，谢谢使用！")`

const ipywidgetsExample = `print(f"a = {a}")`

// 自动连接内核
onMounted(() => {
  connectKernel()
})

onUnmounted(() => {
  console.log('Component is unmounting, disconnecting Thebe session...')
  disconnect()
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
