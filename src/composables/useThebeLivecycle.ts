import type { ISessionConnection } from '@jupyterlab/services/lib/session/session'

/**
 * 在页面卸载时，向 Jupyter 服务器发送一个 'fire-and-forget' 的 shutdown 请求。
 * 使用 fetch + keepalive 来确保请求能被成功调度。
 * @param sessionConnection - 当前活动的会话连接对象
 */
export function sendShutdownRequestOnUnload(sessionConnection: ISessionConnection | null) {
  // 1. 前置检查 (检查会话对象是否存在)
  if (!sessionConnection) {
    console.log('[pagehide] No active session connection, skipping unload cleanup.')
    return
  }

  // 2. 从会话连接对象上同时获取 settings 和 sessionId
  //    这完美对应了原始代码的逻辑！
  const settings = sessionConnection.serverSettings
  const sessionId = sessionConnection.id

  // 3. 构建 URL (逻辑不变)
  const url = `${settings.baseUrl}/api/sessions/${sessionId}`

  // 4. 构建 RequestInit 对象 (逻辑不变)
  const init: RequestInit = {
    method: 'DELETE',
    keepalive: true,
  }

  // 5. 构建 Request 对象并添加认证 (逻辑不变)
  const request = new Request(url, init)
  if (settings.token) {
    request.headers.append('Authorization', `token ${settings.token}`)
  }

  console.log(`[pagehide] Page is unloading, sending shutdown request for session: ${sessionId}`)

  // 6. 发送请求 (逻辑不变)
  try {
    fetch(request)
  } catch (e) {
    console.error('[pagehide] Failed to dispatch fetch request:', e)
  }
}
