import { reactive } from 'vue'
import type { ConnectionState, ConnectionStats } from './types'
import { ConnectionStatus } from './types'

export class ConnectionStatusManager {
  private _state = reactive<ConnectionState>({
    status: ConnectionStatus.IDLE,
    isReady: false,
    kernelStatus: 'idle',
    error: null,
    lastError: null
  })

  private _stats = reactive<ConnectionStats>({
    connectedAt: null,
    lastActivity: Date.now(),
    reconnectCount: 0
  })

  get state() {
    return this._state
  }

  get stats() {
    return this._stats
  }

  // 状态转换方法
  setConnecting() {
    this._state.status = ConnectionStatus.CONNECTING
    this._state.error = null
    this._state.kernelStatus = 'starting'
  }

  setConnected() {
    this._state.status = ConnectionStatus.CONNECTED
    this._state.isReady = true
    this._state.kernelStatus = 'ready'
    this._stats.connectedAt = Date.now()
    this.updateActivity()
  }

  setError(error: Error) {
    this._state.status = ConnectionStatus.ERROR
    this._state.error = error
    this._state.isReady = false
    this._state.lastError = {
      timestamp: Date.now(),
      message: error.message
    }
  }

  setDisconnected(reason?: string) {
    this._state.status = ConnectionStatus.DISCONNECTED
    this._state.isReady = false
    this._state.kernelStatus = reason || 'disconnected'
    this._stats.connectedAt = null
  }

  updateActivity() {
    this._stats.lastActivity = Date.now()
  }

  incrementReconnect() {
    this._stats.reconnectCount++
  }

  // 检查是否可以执行代码
  canExecute(): boolean {
    return this._state.status === ConnectionStatus.CONNECTED && this._state.isReady
  }

  // 检查是否需要重连
  needsReconnection(): boolean {
    return this._state.status === ConnectionStatus.ERROR || 
           this._state.status === ConnectionStatus.DISCONNECTED
  }

  reset() {
    this._state.status = ConnectionStatus.IDLE
    this._state.isReady = false
    this._state.kernelStatus = 'idle'
    this._state.error = null
    this._stats.connectedAt = null
  }
}