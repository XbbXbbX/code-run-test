import type { CoreOptions } from 'thebe-core'

export function getDefaultThebeConfig(): Partial<CoreOptions> {
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
    savedSessionOptions: {
      enabled: false, // 暂时禁用会话保存
    }
  }
}