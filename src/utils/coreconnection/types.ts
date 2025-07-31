export enum ConnectionStatus {
  IDLE = 'idle',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error',
  DISCONNECTED = 'disconnected'
}

export interface ConnectionState {
  status: ConnectionStatus
  isReady: boolean
  kernelStatus: string
  error: Error | null
  lastError: { timestamp: number; message: string } | null
}

export interface ConnectionStats {
  connectedAt: number | null
  lastActivity: number
  reconnectCount: number
}