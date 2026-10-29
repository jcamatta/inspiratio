import { describe, expect, it } from 'vitest'
import { makeItem, makeTag } from '../../../../__test__/fake-api.ts'
import { createOptionId } from '../../../../shared/lib/create-option.ts'
import { cx } from '../../../../shared/lib/cx.ts'
import {
  bulkTagUpdates,
  commonTagIds,
  labelFor,
  listIdsFor,
  splitSelection,
  toChipOptions,
} from '../../../tags/domain/tag-options.ts'
import { formatBytes, formatDate, hostOf, mediaPathOf, metadataRows } from '../metadata.ts'

describe('metadata', () => {
  it('formats bytes, dates and hosts', () => {
    expect(formatBytes(10)).toBe('10 B')
    expect(formatBytes(2048)).toBe('2.0 KB')
    expect(formatBytes(3 * 1024 * 1024)).toBe('3.0 MB')
    expect(formatDate('nope')).toBe('nope')
    expect(formatDate('2026-10-27T10:00:00.000Z')).toMatch(/2026/)
    expect(hostOf('https://www.pinterest.com/pin/1')).toBe('pinterest.com')
    expect(hostOf('bad')).toBe('bad')
  })

  it('joins media paths with the separator of the storage directory', () => {
    expect(mediaPathOf({ directory: 'C:\\data\\media\\', fileName: 'a.png' })).toBe(
      'C:\\data\\media\\a.png',
    )
    expect(mediaPathOf({ directory: '/home/me/media', fileName: 'a.png' })).toBe(
      '/home/me/media/a.png',
    )
  })

  it('lists rows, including optional source and file name', () => {
    const base = makeItem({ id: 'a' })
    expect(metadataRows(base).map((row) => row.label)).toEqual([
      'Type',
      'Dimensions',
      'File size',
      'Origin',
      'Added',
      'Updated',
    ])
    const rich = makeItem({
      id: 'b',
      kind: 'video',
      media: { fileName: 'b.mp4', mimeType: 'video', bytes: 1, width: null, height: null },
      metadata: {
        ...base.metadata,
        origin: 'url',
        sourceUrl: 'https://cosmos.so/x',
        originalFileName: 'clip.mp4',
      },
    })
    const rows = metadataRows(rich)
    expect(rows.find((row) => row.label === 'Source')).toEqual({
      label: 'Source',
      value: 'cosmos.so',
      href: 'https://cosmos.so/x',
    })
    expect(rows.find((row) => row.label === 'Dimensions')?.value).toBe('Unknown')
    expect(rows[0]?.value).toBe('video · video')
  })
})

describe('tag options', () => {
  const tags = [
    makeTag({ id: 't1', name: 'Noir' }),
    makeTag({ id: 't2', name: 'Warm', system: true }),
  ]

  it('builds options and the create sentinel', () => {
    expect(toChipOptions(tags)[1]).toEqual({ id: 't2', name: 'Warm', color: 'mint', system: true })
    expect(listIdsFor({ tags, inputValue: ' noir ', creatable: true })).toEqual(['t1', 't2'])
    expect(listIdsFor({ tags, inputValue: 'teal  look', creatable: true })).toEqual([
      't1',
      't2',
      createOptionId('teal look'),
    ])
    expect(listIdsFor({ tags, inputValue: 'teal', creatable: false })).toEqual(['t1', 't2'])
    expect(labelFor({ tags, id: createOptionId('x') })).toBe('Create "x"')
    expect(labelFor({ tags, id: 'zz' })).toBe('zz')
    expect(splitSelection(['t1', createOptionId('new')])).toEqual({
      existing: ['t1'],
      toCreate: ['new'],
    })
  })

  it('computes shared tags and bulk updates', () => {
    const items = [
      makeItem({ id: 'a', tagIds: ['t1', 't2'] }),
      makeItem({ id: 'b', tagIds: ['t1'] }),
    ]
    expect(commonTagIds([])).toEqual([])
    expect(commonTagIds(items)).toEqual(['t1'])
    expect(bulkTagUpdates({ items, previous: ['t1'], next: ['t1', 't3'] })).toEqual([
      { id: 'a', tagIds: ['t1', 't2', 't3'] },
      { id: 'b', tagIds: ['t1', 't3'] },
    ])
    expect(bulkTagUpdates({ items, previous: ['t1'], next: [] })).toEqual([
      { id: 'a', tagIds: ['t2'] },
      { id: 'b', tagIds: [] },
    ])
    expect(bulkTagUpdates({ items, previous: ['t1'], next: ['t1'] })).toEqual([])
  })

  it('joins class names', () => {
    expect(cx('a', false, null, undefined, '', 'b')).toBe('a b')
  })
})
