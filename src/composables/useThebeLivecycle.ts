import type { ThebeSession } from 'thebe-core'

/**
 * 在页面卸载时，向 Jupyter 服务器发送一个 'fire-and-forget' 的 shutdown 请求。
 * @param session - 当前活动的 ThebeSession 对象
 */
export function sendShutdownRequestOnUnload(session: ThebeSession | null) {
  // 1. 前置检查
  if (!session) {
    console.log('[pagehide] No active session, skipping unload cleanup.')
    return
  }

  console.log('[pagehide] Starting cleanup process...')
  console.log('[pagehide] Session ID:', session.id)
  console.log('[pagehide] Session object:', session)

  try {
    // 2. 从 ThebeSession 获取所需信息
    const sessionId = session.id

    // 通过 server 属性获取服务器设置
    const server = session.server
    console.log('[pagehide] Server object:', server)

    if (!server) {
      console.error('[pagehide] No server found in session')
      return
    }

    // 尝试从 server 获取 serverSettings
    // const settings = (server as any).serverSettings || (server as any).settings
    // console.log('[pagehide] Settings found:', settings)
    // console.log('[pagehide] Available server properties:', Object.keys(server))

    // if (!settings || !settings.baseUrl) {
    //   console.error('[pagehide] No server settings found')
    //   return
    // }

    // 尝试从 server.config 获取服务器设置
    let settings: any = null
    
    // 方法1: 从 server.config.serverSettings 获取
    if ((server as any).config?.serverSettings) {
      settings = (server as any).config.serverSettings
      console.log('[pagehide] Found settings from server.config.serverSettings:', settings)
    }
    
    // 方法2: 从 server.config 直接获取
    else if ((server as any).config) {
      const config = (server as any).config
      console.log('[pagehide] Config object keys:', Object.keys(config))
      
      // 查找包含 baseUrl 的配置
      for (const key of Object.keys(config)) {
        const value = config[key]
        if (value && typeof value === 'object' && value.baseUrl) {
          settings = value
          console.log('[pagehide] Found settings from config.' + key + ':', settings)
          break
        }
      }
    }

    if (!settings || !settings.baseUrl) {
      console.error('[pagehide] No server settings found with baseUrl')
      return
    }

    // 3. 构建关闭会话的请求
    // const url = `${settings.baseUrl}api/sessions/${sessionId}`
    const baseUrl = settings.baseUrl.replace(/\/+$/, '') // 移除末尾斜杠
    const url = `${baseUrl}/api/sessions/${sessionId}`
    console.log('[pagehide] Constructed URL:', url)

     // 方案1: 尝试 sendBeacon (更可靠)
    // if (navigator.sendBeacon) {
    //   console.log('[pagehide] Trying sendBeacon...')
      
    //   // sendBeacon 的 DELETE 请求解决方案
    //   // try {
    //   //   // 方案1a: 使用查询参数模拟 DELETE
    //   //   let beaconUrl = `${url}?_method=DELETE`
    //   //   if (settings.token) {
    //   //     beaconUrl += `&token=${encodeURIComponent(settings.token)}`
    //   //   }
        
    //   //   const sent = navigator.sendBeacon(beaconUrl, new Blob([''], { type: 'text/plain' }))
    //   //   console.log('[pagehide] sendBeacon with query params result:', sent)
        
    //   //   if (sent) {
    //   //     console.log('[pagehide] Successfully sent shutdown request via sendBeacon')
    //   //     return // 成功发送，直接返回
    //   //   }
    //   // } catch (e) {
    //   //   console.error('[pagehide] sendBeacon with query params failed:', e)
    //   // }

    //   // 方案1b: 使用 FormData 模拟 DELETE
    //   try {
    //     const formData = new FormData()
    //     formData.append('_method', 'DELETE')
    //     if (settings.token) {
    //       formData.append('token', settings.token)
    //     }
        
    //     const sent = navigator.sendBeacon(url, formData)
    //     console.log('[pagehide] sendBeacon with FormData result:', sent)
        
    //     if (sent) {
    //       console.log('[pagehide] Successfully sent shutdown request via sendBeacon (FormData)')
    //       return
    //     }
    //   } catch (e) {
    //     console.error('[pagehide] sendBeacon with FormData failed:', e)
    //   }
    // } else {
    //   console.log('[pagehide] sendBeacon not supported')
    // }

    // 方案2: 回退到 fetch (添加更详细的日志)
    console.log('[pagehide] Falling back to fetch with keepalive...')
    
    const init: RequestInit = {
      method: 'DELETE',
      keepalive: true,
      mode: 'cors', // 先尝试 cors
      headers: {},
    }

    // 添加认证头（如果存在）
    if (settings.token) {
      (init.headers as Record<string, string>)['Authorization'] = `token ${settings.token}`
    }

    console.log('[pagehide] Fetch options:', init)
    console.log('[pagehide] Request URL:', url)

    const startTime = Date.now()
    
    fetch(url, init)
      .then(response => {
        const endTime = Date.now()
        console.log(`[pagehide] Fetch completed in ${endTime - startTime}ms`)
        console.log('[pagehide] Response status:', response.status)
        console.log('[pagehide] Response ok:', response.ok)
        return response
      })
      .catch((e) => {
        const endTime = Date.now()
        console.error(`[pagehide] Fetch failed after ${endTime - startTime}ms:`, e)
        console.error('[pagehide] Error type:', e.constructor.name)
        console.error('[pagehide] Error message:', e.message)
        
        // 如果是网络错误，尝试 no-cors 模式
        if (e.name === 'TypeError' && e.message.includes('Failed to fetch')) {
          console.log('[pagehide] Trying no-cors mode...')
          
          const noCorsInit: RequestInit = {
            method: 'DELETE',
            keepalive: true,
            mode: 'no-cors',
          }
          
          fetch(url, noCorsInit).catch(noCorsError => {
            console.error('[pagehide] No-cors fetch also failed:', noCorsError)
          })
        }
      })

  } catch (e) {
    console.error('[pagehide] Error in shutdown cleanup:', e)
    console.error('[pagehide] Error stack:', (e as Error).stack)
  }

  //   const init: RequestInit = {
  //     method: 'DELETE',
  //     keepalive: true, // 关键：确保在页面卸载时请求能够发送
  //   }

  //   const request = new Request(url, init)

  //   // 添加认证头（如果存在）
  //   if (settings.token) {
  //     request.headers.append('Authorization', `token ${settings.token}`)
  //   }

  //   console.log(`[pagehide] Page is unloading, sending shutdown request for session: ${sessionId}`)

  //   // 4. 发送请求（fire-and-forget）
  //   fetch(request).catch((e) => {
  //     console.error('[pagehide] Failed to send shutdown request:', e)
  //   })
  // } catch (e) {
  //   console.error('[pagehide] Error in shutdown cleanup:', e)
  // }
}
