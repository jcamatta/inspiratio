import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadConfig } from '../config.ts'

describe('loadConfig', () => {
  it('uses sensible local defaults', () => {
    const root = resolve('/repo')
    const config = loadConfig({ env: {}, rootDir: root })
    expect(config).toMatchObject({
      host: '127.0.0.1',
      port: 4319,
      dataDir: join(root, 'data'),
      logLevel: 'info',
      logFormat: 'pretty',
      apiUrl: 'http://127.0.0.1:4319',
      maxImportBytes: 300 * 1024 * 1024,
    })
    expect(config.mediaDir).toBe(join(root, 'data', 'media'))
  })

  it('reads overrides from the environment', () => {
    const absolute = resolve('/library')
    const config = loadConfig({
      env: {
        INSPIRATIO_DATA_DIR: absolute,
        INSPIRATIO_PORT: '5000',
        INSPIRATIO_LOG_LEVEL: 'debug',
        INSPIRATIO_LOG_FORMAT: 'json',
        INSPIRATIO_API_URL: 'http://api',
        INSPIRATIO_MAX_IMPORT_MB: 'oops',
      },
      rootDir: '/repo',
    })
    expect(config).toMatchObject({
      dataDir: absolute,
      port: 5000,
      logLevel: 'debug',
      logFormat: 'json',
      apiUrl: 'http://api',
      maxImportBytes: 300 * 1024 * 1024,
    })
  })
})
