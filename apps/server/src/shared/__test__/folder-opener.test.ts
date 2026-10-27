import { EventEmitter } from 'node:events'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSystemFolderOpener } from '../system/folder-opener.ts'

const spawned = vi.hoisted(() => ({ calls: [] as unknown[][], fail: false }))

vi.mock('node:child_process', () => ({
  spawn: (...args: unknown[]) => {
    spawned.calls.push(args)
    const child = Object.assign(new EventEmitter(), { unref: vi.fn() })
    queueMicrotask(() => {
      if (spawned.fail) child.emit('error', new Error('ENOENT'))
      else child.emit('spawn')
    })
    return child
  },
}))

describe('system folder opener', () => {
  beforeEach(() => {
    spawned.calls.length = 0
    spawned.fail = false
  })

  it('uses the file manager of each platform', async () => {
    await createSystemFolderOpener('win32')('C:/media')
    await createSystemFolderOpener('darwin')('/media')
    await createSystemFolderOpener('linux')('/media')
    expect(spawned.calls.map((call) => call[0])).toEqual(['explorer', 'open', 'xdg-open'])
  })

  it('rejects when the command cannot start', async () => {
    spawned.fail = true
    await expect(createSystemFolderOpener('linux')('/media')).rejects.toThrow('ENOENT')
  })
})
