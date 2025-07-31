import { reactive, readonly, onUnmounted } from 'vue'
import * as thebe from 'thebe-core'
import type { ThebeNotebook } from 'thebe-core'
import type { ThebeSession } from 'thebe-core'
import type { ThebeServer } from 'thebe-core'
import type { Config, CoreOptions } from 'thebe-core'
import type { IOutput } from '@jupyterlab/nbformat'

// 状态管理
const state = reactive({
  isConnecting: false,
  isReady: false,
  kernelStatus: 'idle',
  error: null as Error | null,
  //status有running，completed，error
  cellExecutions: new Map<string, { status: string; output: any[] }>(),
  // 新增：更细粒度的连接状态
  connectionStatus: 'idle' as 'idle' | 'connecting' | 'connected' | 'error' | 'disconnected',
  // 新增：输入相关状态
  inputRequests: new Map<
    string,
    {
      cellId: string
      prompt: string
      password: boolean
      resolve: (value: string) => void
    }
  >(),
})

// 存储全局实例
let thebeServer: ThebeServer | null = null
let thebeSession: ThebeSession | null = null
let thebeNotebook: ThebeNotebook | null = null
let renderMimeRegistry: any = null
let config: Config | null = null
// 优化后的代码块管理
const notebookCells = new Map<string, any>() // 缓存所有 cells
// 跟踪当前执行的cell
let currentExecutingCell: string | null = null
// 获取当前执行的cell ID
function getCurrentExecutingCell(): string {
  return currentExecutingCell || 'unknown-cell'
}

// 新增：处理输入请求
function handleInputRequest(data: {
  cellId: string
  prompt: string
  password: boolean
  msgId?: string
}) {
  console.log('Handling input request for cell:', data.cellId)

  // 更新cell状态为等待输入
  const execution = state.cellExecutions.get(data.cellId)
  if (execution) {
    execution.status = 'waiting_for_input'
    state.cellExecutions.set(data.cellId, execution)
  }

  // 创建Promise来等待用户输入
  return new Promise<string>((resolve) => {
    // 存储输入请求信息
    state.inputRequests.set(data.cellId, {
      cellId: data.cellId,
      prompt: data.prompt,
      password: data.password,
      resolve,
    })
  })
}

export function useThebe() {
  // 初始化并连接到Binder
  async function initializeKernel(options?: Partial<CoreOptions>) {
    if (state.isConnecting || state.isReady) return

    state.isConnecting = true
    state.error = null
    state.kernelStatus = 'starting'

    try {
      // 创建配置
      // 1. 创建事件系统 - 用于监听和处理 Thebe 内部的各种事件
      // 作用：提供发布-订阅模式，让不同组件之间可以通信
      // 运作时机：贯穿整个 Thebe 生命周期
      const events = thebe.makeEvents()
      // 2. 创建配置对象 - 合并用户配置和默认配置，并绑定事件系统
      // 参数：options（用户自定义配置）|| getDefaultOptions()（默认配置）, events（事件系统）
      // 作用：统一管理 Thebe 的所有配置选项，包括内核选项、Binder 选项等
      // 产生结果：一个包含完整配置信息的 Config 对象
      config = thebe.makeConfiguration(options || getDefaultOptions(), events)

      // 创建渲染器
      // 3. 创建 MIME 渲染注册表 - 负责将不同格式的输出渲染为可显示内容
      // 参数：config.mathjax（数学公式渲染配置）
      // 作用：注册各种 MIME 类型的渲染器（如 text/html, image/png, application/json 等）
      // 运作时机：当代码执行产生输出时，用于将输出转换为用户可见的格式
      // 产生结果：一个渲染器注册表，包含各种输出格式的处理函数
      renderMimeRegistry = thebe.makeRenderMimeRegistry(config.mathjax)

      // 设置事件监听
      // 4. 设置状态事件监听器 - 监听服务器和内核的状态变化
      // 运作时机：服务器启动、内核启动、会话创建等各个阶段
      // 作用：实时更新 UI 状态，让用户知道当前连接状态
      events.on('status' as any, (event: string, data: any) => {
        console.log('Server status:', event, data)
        state.kernelStatus = data.status || event
        if (data.status === 'ready' || data.status === 'server-ready') {
          state.isReady = true
          state.isConnecting = false
        }
      })
      // 设置错误事件监听器 - 处理连接或执行过程中的错误
      // 运作时机：任何阶段出现错误时触发
      // 作用：捕获并显示错误信息，更新错误状态
      events.on('error' as any, (event: string, data: any) => {
        console.error('Thebe error:', event, data)
        state.error = new Error(data.message || 'Unknown error')
        state.isConnecting = false
      })

      // 新增：监听输入请求事件
      events.on('input_request' as any, (data: any) => {
        console.log('Input request received:', data)
        handleInputRequest(data)
      })

      // 连接到服务器
      // 6. 连接到 Binder 服务器 - 这是核心的服务器连接步骤
      // 参数：config（包含 Binder 配置的完整配置对象）
      // 作用：向 Binder 发送请求，启动一个新的 Jupyter 服务器实例
      // 运作过程：
      //   - 向 mybinder.org 发送构建请求
      //   - Binder 根据指定的 GitHub 仓库构建环境
      //   - 启动一个临时的 Jupyter 服务器
      // 产生结果：一个 ThebeServer 对象，代表运行中的 Jupyter 服务器
      thebeServer = thebe.connectToBinder(config)

      // 等待服务器准备就绪
      // 7. 等待服务器完全启动 - 这是一个异步过程
      // 运作时机：Binder 构建环境并启动服务器的过程中
      // 作用：确保服务器完全可用后再进行下一步
      // 时间：通常需要几十秒到几分钟，取决于环境复杂度
      await thebeServer.ready

      // 创建会话 - 需要传入 rendermime
      // 8. 创建新的内核会话 - 在准备好的服务器上启动一个 Python 内核
      // 参数：renderMimeRegistry（渲染器注册表，用于处理输出）
      // 作用：创建一个可以执行代码的会话环境
      // 产生结果：一个 ThebeSession 对象，可以用来执行 Python 代码
      // 运作机制：向 Jupyter 服务器发送创建内核的请求
      thebeSession = await thebeServer.startNewSession(renderMimeRegistry)

      // 新增：为会话添加输入请求监听
      if (thebeSession && (thebeSession as any).kernel) {
        const kernel = (thebeSession as any).kernel

        // 监听内核消息
        kernel.anyMessage.connect((sender: any, args: any) => {
          const { msg } = args
          if (msg.header.msg_type === 'input_request') {
            console.log('Kernel input request:', msg)
            handleInputRequest({
              cellId: getCurrentExecutingCell(),
              prompt: msg.content.prompt || '请输入:',
              password: msg.content.password || false,
              msgId: msg.header.msg_id,
            })
          }
        })
      }

      // 9. 更新最终状态 - 标记初始化完成
      state.isReady = true
      state.isConnecting = false
      state.kernelStatus = 'ready'
    } catch (err) {
      console.error('Failed to initialize Thebe kernel:', err)
      state.error = err as Error
      state.isConnecting = false
      state.kernelStatus = 'error'
    }
  }

  // 执行代码块
  async function executeCode(code: string, cellId: string) {
    // 1. 前置检查 - 确保会话已准备就绪
    // 检查内容：thebeSession（内核会话）是否存在，state.isReady（整体状态）是否为真
    // 作用：防止在内核未初始化时执行代码，避免运行时错误
    // 应用场景：用户在连接建立前就点击执行按钮的情况
    if (!thebeSession || !state.isReady) {
      console.error('Session is not ready')
      return null
    }

    // 设置当前执行的cell
    currentExecutingCell = cellId

    // 初始化单元格执行状态
    // 2. 初始化执行状态跟踪 - 为当前代码块创建执行记录
    // 参数：cellId（唯一标识符），status: 'running'（执行中），output: []（空输出数组）
    // 作用：在状态管理中记录这个代码块正在执行，供UI组件显示执行状态
    // 实际效果：ExecutableCode.vue 组件中的 isExecuting 状态会变为 true
    state.cellExecutions.set(cellId, {
      status: 'running',
      output: [],
    })

    try {
      // 创建一个简单的代码块
      // 3. 创建代码块结构 - 将用户输入的代码包装为 Thebe 可识别的格式
      // 示例：对于 "print('Hello, World!')"
      // 结果：{ id: "cell-xxx", source: "print('Hello, World!')", kind: "code", metadata: {} }
      const codeBlock = {
        id: cellId,
        source: code,
        kind: 'code' as const,
        metadata: {},
      }

      // 如果没有 notebook，创建一个
      // 4. Notebook 管理 - 创建或获取代码执行容器
      // 背景：Thebe 基于 Jupyter Notebook 概念，需要一个 notebook 容器来管理多个代码单元格
      // 首次执行时：thebeNotebook 为 null，需要创建新的 notebook
      if (!thebeNotebook) {
        thebeNotebook = thebe.setupNotebookFromBlocks([codeBlock], config!, renderMimeRegistry)
        //  将 notebook 与活跃的内核会话连接
        // 作用：让 notebook 中的代码可以在远程内核中执行
        thebeNotebook.attachSession(thebeSession)
      }

      // 5. 单元格管理 - 获取或创建目标执行单元格
      // 尝试从现有 notebook 中获取指定 ID 的单元格
      let cell = thebeNotebook.getCellById(cellId)
      if (!cell) {
        // 如果没有找到指定的cell，创建一个新的cell
        // 5a. 单元格不存在的处理 - 重新创建包含新单元格的 notebook
        // 场景：用户执行了一个新的代码块，但当前 notebook 中没有对应的 cell
        const newCodeBlock = {
          id: cellId,
          source: code,
          kind: 'code' as const,
          metadata: {},
        }

        // 重新构建 notebook - 用新的代码块替换整个 notebook
        // 注意：这是一种简化处理，实际可能需要保留其他已存在的 cells
        thebeNotebook = thebe.setupNotebookFromBlocks([newCodeBlock], config!, renderMimeRegistry)
        thebeNotebook.attachSession(thebeSession)
        cell = thebeNotebook.getCellById(cellId)
      } else {
        // 5b. 单元格存在的处理 - 更新现有单元格的源代码
        // 场景：用户修改了代码后重新执行同一个代码块
        // 示例：将 "print('Hello')" 改为 "print('Hello, World!')"
        cell.source = code
      }
      //确保单元格创建成功
      if (!cell) {
        console.error('Could not create or find cell')
        return null
      }

      // 执行单元格
      // 核心执行步骤 - 在远程内核中执行代码
      // 参数：code（Python 代码字符串）
      // 过程：将代码发送到 Binder 上的 Python 内核，等待执行完成
      //
      // 具体示例分析：
      //
      // 示例1：print('Hello, World!')
      // - 发送到内核：代码字符串被传输到远程 Python 解释器
      // - 内核执行：Python 解释器运行 print 函数
      // - 产生输出：标准输出流产生文本 "Hello, World!"
      // - 返回结果：{ output_type: 'stream', name: 'stdout', text: 'Hello, World!\n' }
      //
      // 示例2：matplotlib 绘图代码
      // - 发送到内核：完整的绘图代码（import, 数据生成, 绘图命令）
      // - 内核执行：
      //   * import matplotlib.pyplot as plt （导入绘图库）
      //   * import numpy as np （导入数值计算库）
      //   * x = np.linspace(0, 10, 100) （生成 x 轴数据）
      //   * y = np.sin(x) （计算正弦值）
      //   * plt.figure(figsize=(8, 4)) （创建图形窗口）
      //   * plt.plot(x, y) （绘制曲线）
      //   * plt.title('Sine Wave') （设置标题）
      //   * plt.grid(True) （显示网格）
      //   * plt.show() （显示图形）
      // - 产生输出：PNG 图像数据（base64 编码）
      // - 返回结果：{ output_type: 'display_data', data: { 'image/png': 'base64数据...' } }
      const result = await cell.execute(code)

      // 更新执行状态
      // 执行结果处理 - 更新状态并保存输出
      const execution = state.cellExecutions.get(cellId)
      if (execution) {
        // 标记执行完成
        execution.status = 'completed'
        // 保存输出结果 - cell.outputs 包含所有类型的输出
        // 可能的输出类型：
        // - 文本输出：{ output_type: 'stream', text: '...' }
        // - 图像输出：{ output_type: 'display_data', data: { 'image/png': '...' } }
        // - HTML输出：{ output_type: 'display_data', data: { 'text/html': '...' } }
        // - 错误输出：{ output_type: 'error', ename: '...', evalue: '...', traceback: [...] }
        execution.output = cell.outputs || []
        // 更新全局状态 - 让 Vue 组件可以响应式地获取执行结果
        state.cellExecutions.set(cellId, execution)
      }
      // 返回执行结果 - 供调用组件使用
      return { output: cell.outputs || [] }
    } catch (error) {
      console.error('Execution error:', error)
      const execution = state.cellExecutions.get(cellId)
      // 新增：检查是否是连接相关错误
      if (isConnectionError(error as Error)) {
        state.connectionStatus = 'disconnected'
        state.isReady = false
      }
      if (execution) {
        execution.status = 'error'
        execution.output = [
          { output_type: 'error', ename: 'Error', evalue: String(error), traceback: [] },
        ]
        state.cellExecutions.set(cellId, execution)
      }
      throw error
    } finally {
      // 清理当前执行状态
      currentExecutingCell = null
    }
  }

  // 新增：发送用户输入到内核
  async function sendInputReply(cellId: string, inputValue: string) {
    console.log('Sending input reply for cell:', cellId, 'value:', inputValue)

    const inputRequest = state.inputRequests.get(cellId)
    if (!inputRequest) {
      console.error('No input request found for cell:', cellId)
      return
    }

    try {
      // 如果有内核连接，发送input_reply消息
      if (thebeSession && (thebeSession as any).kernel) {
        const kernel = (thebeSession as any).kernel

        if (typeof kernel.sendInputReply === 'function') {
          kernel.sendInputReply({ value: inputValue })
        }
        // // 构建input_reply消息
        // const replyMsg = {
        //   header: {
        //     msg_id: kernel.createMessageId(),
        //     msg_type: 'input_reply',
        //     username: 'user',
        //     session: kernel.sessionId,
        //     date: new Date().toISOString(),
        //     version: '5.3',
        //   },
        //   parent_header: {},
        //   metadata: {},
        //   content: {
        //     value: inputValue,
        //   },
        // }

        // // 发送消息到内核
        // kernel.sendInputReply(replyMsg.content)
      }

      // 清理输入请求状态
      state.inputRequests.delete(cellId)

      // 恢复执行状态
      const execution = state.cellExecutions.get(cellId)
      if (execution) {
        execution.status = 'running'
        state.cellExecutions.set(cellId, execution)
      }

      // 解析Promise
      inputRequest.resolve(inputValue)
    } catch (error) {
      console.error('Error sending input reply:', error)

      // 清理状态
      state.inputRequests.delete(cellId)
      const execution = state.cellExecutions.get(cellId)
      if (execution) {
        execution.status = 'error'
        state.cellExecutions.set(cellId, execution)
      }
    }
  }

  // 简单的错误检测
  function isConnectionError(error: Error): boolean {
    const connectionErrors = ['fetch', 'network', 'cors', 'websocket']
    return connectionErrors.some((keyword) => error.message.toLowerCase().includes(keyword))
  }

  // 断开连接
  function disconnect() {
    try {
      if (thebeSession) {
        thebeSession.shutdown()
      }
    } catch (e) {
      console.warn('Error shutting down session:', e)
    }

    try {
      if (thebeServer) {
        thebeServer.shutdownAllSessions()
      }
    } catch (e) {
      console.warn('Error shutting down server:', e)
    }

    // 重置所有状态
    thebeSession = null
    thebeServer = null
    thebeNotebook = null
    state.isReady = false
    state.connectionStatus = 'idle'
    state.kernelStatus = 'idle'
    state.cellExecutions.clear()
  }

  // 手动重连功能
  async function reconnect() {
    // 清理现有连接
    disconnect()
    // 重新初始化
    await initializeKernel()
  }

  // 默认配置选项
  function getDefaultOptions(): Partial<CoreOptions> {
    return {
      kernelOptions: {
        kernelName: 'python3',
      },
      binderOptions: {
        repo: 'binder-examples/requirements',
        ref: 'master',
        binderUrl: 'https://mybinder.org',
        repoProvider: 'github',
      },
    }
  }

  // 自动清理
  onUnmounted(() => {
    disconnect()
  })

  return {
    // 只读状态
    state: readonly(state),
    // 可调用方法
    initializeKernel,
    executeCode,
    sendInputReply,
    disconnect,
    // 渲染输出的辅助方法
    renderOutput(output: IOutput) {
      // 处理不同类型的输出
      if (!output || !renderMimeRegistry) return null
      if (output.output_type === 'stream') {
        return (output as any).text
      } else if (output.output_type === 'display_data' || output.output_type === 'execute_result') {
        const data = (output as any).data
        // 处理各种MIME类型
        if (data && data['text/html']) {
          return { html: data['text/html'] }
        }
        if (data && data['image/png']) {
          return {
            image: `data:image/png;base64,${data['image/png']}`,
          }
        }
        if (data && data['text/plain']) {
          return data['text/plain']
        }
      } else if (output.output_type === 'error') {
        return (output as any).traceback.join('\n')
      }
      return null
    },
  }
}
