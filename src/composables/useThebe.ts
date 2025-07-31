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
  cellExecutions: new Map<string, { status: string; output: any[] }>(),
})

// 存储全局实例
let thebeServer: ThebeServer | null = null
let thebeSession: ThebeSession | null = null
let thebeNotebook: ThebeNotebook | null = null
let renderMimeRegistry: any = null
let config: Config | null = null

export function useThebe() {
  // 初始化并连接到Binder
  async function initializeKernel(options?: Partial<CoreOptions>) {
    if (state.isConnecting || state.isReady) return

    state.isConnecting = true
    state.error = null
    state.kernelStatus = 'starting'

    try {
      // 创建配置
      const events = thebe.makeEvents()
      config = thebe.makeConfiguration(options || getDefaultOptions(), events)

      // 创建渲染器
      renderMimeRegistry = thebe.makeRenderMimeRegistry(config.mathjax)

      // 设置事件监听
      events.on('status' as any, (event: string, data: any) => {
        console.log('Server status:', event, data)
        state.kernelStatus = data.status || event
        if (data.status === 'ready' || data.status === 'server-ready') {
          state.isReady = true
          state.isConnecting = false
        }
      })

      events.on('error' as any, (event: string, data: any) => {
        console.error('Thebe error:', event, data)
        state.error = new Error(data.message || 'Unknown error')
        state.isConnecting = false
      })

      // 连接到服务器
      thebeServer = thebe.connectToBinder(config)

      // 等待服务器准备就绪
      await thebeServer.ready

      // 创建会话 - 需要传入 rendermime
      thebeSession = await thebeServer.startNewSession(renderMimeRegistry)

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
    if (!thebeSession || !state.isReady) {
      console.error('Session is not ready')
      return null
    }

    // 初始化单元格执行状态
    state.cellExecutions.set(cellId, {
      status: 'running',
      output: [],
    })

    try {
      // 创建一个简单的代码块
      const codeBlock = {
        id: cellId,
        source: code,
        kind: 'code' as const,
        metadata: {},
      }

      // 如果没有 notebook，创建一个
      if (!thebeNotebook) {
        thebeNotebook = thebe.setupNotebookFromBlocks([codeBlock], config!, renderMimeRegistry)
        thebeNotebook.attachSession(thebeSession)
      }

      // 获取或创建单元格
      let cell = thebeNotebook.getCellById(cellId)
      if (!cell) {
        // 如果没有找到指定的cell，创建一个新的cell
        const newCodeBlock = {
          id: cellId,
          source: code,
          kind: 'code' as const,
          metadata: {},
        }

        // 重新创建notebook，包含新的cell
        thebeNotebook = thebe.setupNotebookFromBlocks([newCodeBlock], config!, renderMimeRegistry)
        thebeNotebook.attachSession(thebeSession)
        cell = thebeNotebook.getCellById(cellId)
      } else {
        // 更新现有cell的源码
        cell.source = code
      }

      if (!cell) {
        console.error('Could not create or find cell')
        return null
      }

      // 执行单元格
      const result = await cell.execute(code)

      // 更新执行状态
      const execution = state.cellExecutions.get(cellId)
      if (execution) {
        execution.status = 'completed'
        execution.output = cell.outputs || []
        state.cellExecutions.set(cellId, execution)
      }

      return { output: cell.outputs || [] }
    } catch (error) {
      console.error('Execution error:', error)
      const execution = state.cellExecutions.get(cellId)
      if (execution) {
        execution.status = 'error'
        execution.output = [
          { output_type: 'error', ename: 'Error', evalue: String(error), traceback: [] },
        ]
        state.cellExecutions.set(cellId, execution)
      }
      throw error
    }
  }

  // 断开连接
  function disconnect() {
    if (thebeSession) {
      thebeSession.shutdown()
      thebeSession = null
    }
    if (thebeServer) {
      thebeServer.shutdownAllSessions()
      thebeServer = null
    }
    thebeNotebook = null
    state.isReady = false
    state.kernelStatus = 'idle'
    state.cellExecutions.clear()
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
    disconnect,
    // 渲染输出的辅助方法
    renderOutput(output: IOutput) {
      // 处理不同类型的输出
      if (!output) return null

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
