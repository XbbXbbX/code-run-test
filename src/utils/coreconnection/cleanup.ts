import type { ThebeServer, ThebeSession, ThebeNotebook } from 'thebe-core'

export class ConnectionCleanup {
  private resources: {
    server?: ThebeServer | null
    session?: ThebeSession | null
    notebook?: ThebeNotebook | null
    renderRegistry?: any
    config?: any
  } = {}

  setResources(resources: {
    server?: ThebeServer | null
    session?: ThebeSession | null
    notebook?: ThebeNotebook | null
    renderRegistry?: any
    config?: any
  }) {
    this.resources = { ...this.resources, ...resources }
  }

  async cleanup(partial = false) {
    console.log('Starting connection cleanup...')

    // 清理会话
    if (this.resources.session) {
      try {
        await this.resources.session.shutdown?.()
        console.log('Session shutdown completed')
      } catch (error) {
        console.warn('Error during session shutdown:', error)
      }
      this.resources.session = null
    }

    // 清理服务器
    if (this.resources.server && !partial) {
      try {
        await this.resources.server.shutdownAllSessions?.()
        console.log('Server shutdown completed')
      } catch (error) {
        console.warn('Error during server shutdown:', error)
      }
      this.resources.server = null
    }

    // 清理其他资源
    this.resources.notebook = null
    
    if (!partial) {
      this.resources.renderRegistry = null
      this.resources.config = null
    }

    console.log('Connection cleanup completed')
  }

  getResources() {
    return { ...this.resources }
  }
}