import type { GenerationRequest, Item, Section, Tag } from '@inspiratio/shared'
import { describe, expect, it } from 'vitest'
import { NOW } from '../../__test__/harness.ts'
import { sequentialIds } from '../../shared/lib/runtime.ts'
import {
  canTransition,
  createGenerationRequest,
  labelReferences,
  resolveReferences,
  resultPosition,
  transition,
  updateDraft,
} from '../generations/domain/generation.ts'
import {
  absolutePositionOf,
  createItem,
  detachFromSection,
  initialSize,
  matchesSearch,
  nextFreePosition,
  nextZIndex,
  stripTag,
  titleFromSource,
  updateItem,
  withMediaDimensions,
} from '../items/domain/item.ts'
import { createSection, updateSection } from '../sections/domain/section.ts'
import {
  ensureTags,
  findTagByName,
  generatedTagNames,
  isNameTaken,
  pickTagColor,
  updateTag,
} from '../tags/domain/tag.ts'

const item = (overrides: Partial<Item> = {}): Item => ({
  ...createItem({
    id: 'itm_1',
    now: NOW,
    kind: 'image',
    fileName: 'itm_1.png',
    mimeType: 'image/png',
    bytes: 10,
    width: 200,
    height: 100,
    title: 'Neon',
    position: { x: 0, y: 0 },
    sectionId: null,
    zIndex: 1,
    origin: 'upload',
    sourceUrl: null,
    originalFileName: null,
    tagIds: ['t1', 't1'],
    generation: null,
  }),
  ...overrides,
})

const tag = (overrides: Partial<Tag> = {}): Tag => ({
  id: 't1',
  name: 'Noir',
  color: 'mint',
  system: false,
  createdAt: NOW,
  ...overrides,
})

const section: Section = {
  id: 'sec_1',
  title: 'Act I',
  position: { x: 100, y: 50 },
  size: { width: 400, height: 300 },
  color: 'mint',
  createdAt: NOW,
  updatedAt: NOW,
}

describe('item domain', () => {
  it('sizes new items by their longest edge', () => {
    expect(initialSize({ width: 2000, height: 1000, kind: 'image' })).toEqual({
      width: 320,
      height: 160,
    })
    expect(initialSize({ width: null, height: null, kind: 'video' })).toEqual({
      width: 320,
      height: 180,
    })
    expect(initialSize({ width: null, height: null, kind: 'image' })).toEqual({
      width: 320,
      height: 320,
    })
  })

  it('derives titles from explicit title, file name or URL', () => {
    expect(titleFromSource({ title: ' Mine ', originalFileName: 'a.png', sourceUrl: null })).toBe(
      'Mine',
    )
    expect(
      titleFromSource({ title: undefined, originalFileName: 'still-01.jpeg', sourceUrl: null }),
    ).toBe('still-01')
    expect(
      titleFromSource({
        title: '',
        originalFileName: null,
        sourceUrl: 'https://x.dev/a/blade%20runner.png?x',
      }),
    ).toBe('blade runner')
    expect(
      titleFromSource({ title: undefined, originalFileName: null, sourceUrl: 'not a url' }),
    ).toBe('Untitled')
  })

  it('computes z-order and free positions', () => {
    expect(nextZIndex([])).toBe(1)
    expect(nextZIndex([item({ zIndex: 7 })])).toBe(8)
    expect(nextFreePosition([])).toEqual({ x: 0, y: 0 })
    expect(
      nextFreePosition([item({ position: { x: 10, y: 5 } }), item({ sectionId: 'sec' })]),
    ).toEqual({ x: 378, y: 5 })
  })

  it('deduplicates tags and applies patches', () => {
    const base = item()
    expect(base.tagIds).toEqual(['t1'])
    const updated = updateItem({ item: base, patch: { notes: 'n' }, now: 'later' })
    expect(updated).toMatchObject({
      title: 'Neon',
      zIndex: 1,
      metadata: { notes: 'n', updatedAt: 'later' },
    })
    expect(updateItem({ item: base, patch: { title: 'T', zIndex: 3 }, now: 'l' })).toMatchObject({
      title: 'T',
      zIndex: 3,
      metadata: { notes: '' },
    })
  })

  it('keeps aspect ratio when the browser reports video dimensions', () => {
    expect(withMediaDimensions({ item: item(), width: 1080, height: 1920, now: NOW }).size).toEqual(
      { width: 320, height: 569 },
    )
  })

  it('strips tags only from items that had them', () => {
    const [kept, stripped] = stripTag({
      items: [item({ tagIds: [] }), item()],
      tagId: 't1',
      now: 'later',
    })
    expect(kept?.metadata.updatedAt).toBe(NOW)
    expect(stripped?.tagIds).toEqual([])
  })

  it('converts section-relative positions', () => {
    const child = item({ sectionId: 'sec_1', position: { x: 5, y: 5 } })
    expect(absolutePositionOf({ item: child, sections: [section] })).toEqual({ x: 105, y: 55 })
    expect(absolutePositionOf({ item: child, sections: [] })).toEqual({ x: 5, y: 5 })
    const [detached, untouched] = detachFromSection({ items: [child, item()], section, now: NOW })
    expect(detached).toMatchObject({ sectionId: null, position: { x: 105, y: 55 } })
    expect(untouched?.position).toEqual({ x: 0, y: 0 })
  })

  it('searches title, notes, prompt, tags and kind', () => {
    const tags = [tag()]
    const target = item({ metadata: { ...item().metadata, notes: 'teal palette' } })
    expect(matchesSearch({ item: target, tags, criteria: { text: 'TEAL' } })).toBe(true)
    expect(matchesSearch({ item: target, tags, criteria: { tags: ['noir'], kind: 'image' } })).toBe(
      true,
    )
    expect(matchesSearch({ item: target, tags, criteria: { kind: 'video' } })).toBe(false)
    expect(matchesSearch({ item: target, tags, criteria: { tags: ['warm'] } })).toBe(false)
  })
})

describe('tag domain', () => {
  it('finds tags case-insensitively and detects name clashes', () => {
    const tags = [tag()]
    expect(findTagByName({ tags, name: ' noir ' })?.id).toBe('t1')
    expect(isNameTaken({ tags, name: 'NOIR', exceptId: 't2' })).toBe(true)
    expect(isNameTaken({ tags, name: 'NOIR', exceptId: 't1' })).toBe(false)
  })

  it('rotates colours and updates tags', () => {
    expect(pickTagColor([])).toBe('mint')
    expect(pickTagColor([tag()])).toBe('coral')
    expect(updateTag({ tag: tag(), name: undefined, color: 'sky' })).toMatchObject({
      name: 'Noir',
      color: 'sky',
    })
    expect(updateTag({ tag: tag(), name: '  Neo  noir ', color: undefined })).toMatchObject({
      name: 'Neo noir',
      color: 'mint',
    })
  })

  it('ensures tags exist, reusing and creating as needed', () => {
    const result = ensureTags({
      tags: [tag()],
      names: ['noir', 'ai-generated', 'AI-generated'],
      system: true,
      now: NOW,
      newId: sequentialIds(),
    })
    expect(result.ids).toEqual(['t1', 'tag_1'])
    expect(result.tags[1]).toMatchObject({ name: 'ai-generated', system: true, color: 'coral' })
    const user = ensureTags({
      tags: [],
      names: ['warm'],
      system: false,
      now: NOW,
      newId: sequentialIds(),
    })
    expect(user.tags[0]?.color).toBe('mint')
  })

  it('slugs provider and model names', () => {
    expect(generatedTagNames({ provider: 'Higgsfield', model: ' Seedance 2.5 Pro! ' })).toEqual([
      'ai-generated',
      'by:higgsfield',
      'model:seedance-2.5-pro',
    ])
  })
})

describe('section domain', () => {
  it('creates and updates sections', () => {
    const created = createSection({
      id: 's',
      now: NOW,
      input: {
        title: '',
        position: { x: 0, y: 0 },
        size: { width: 100, height: 100 },
        color: 'sky',
      },
    })
    expect(created.title).toBe('Untitled section')
    expect(
      updateSection({ section: created, patch: { title: 'B', color: 'coral' }, now: 'l' }),
    ).toMatchObject({ title: 'B', color: 'coral', updatedAt: 'l' })
    expect(
      updateSection({
        section: created,
        patch: { position: { x: 1, y: 2 }, size: { width: 50, height: 60 } },
        now: 'l',
      }),
    ).toMatchObject({
      title: 'Untitled section',
      position: { x: 1, y: 2 },
    })
  })
})

describe('generation domain', () => {
  const request = (): GenerationRequest =>
    createGenerationRequest({
      id: 'gen_1',
      now: NOW,
      traceId: 'trace',
      position: { x: 10, y: 20 },
      input: {
        submit: true,
        prompt: 'p',
        kind: 'image',
        model: null,
        aspectRatio: null,
        count: 1,
        referenceItemIds: ['itm_1', 'itm_x', 'itm_1'],
      },
    })

  it('labels unique references in order', () => {
    expect(labelReferences(['a', 'b', 'a'])).toEqual([
      { itemId: 'a', label: '@1' },
      { itemId: 'b', label: '@2' },
    ])
  })

  it('enforces the lifecycle state machine', () => {
    expect(canTransition({ from: 'completed', to: 'failed' })).toBe(false)
    expect(canTransition({ from: 'completed', to: 'pending' })).toBe(true)
    expect(canTransition({ from: 'in_progress', to: 'pending' })).toBe(true)
    const started = transition({ request: request(), to: 'in_progress', now: 'l' })
    expect(started).toMatchObject({ ok: true, value: { status: 'in_progress', error: null } })
    const failed = transition({ request: request(), to: 'failed', now: 'l' })
    expect(failed).toMatchObject({ ok: true, value: { error: 'Unknown error' } })
    expect(
      transition({ request: { ...request(), status: 'completed' }, to: 'failed', now: 'l' }).ok,
    ).toBe(false)
    const done = transition({ request: request(), to: 'completed', now: 'l', resultItemIds: ['r'] })
    expect(done).toMatchObject({ ok: true, value: { resultItemIds: ['r'] } })
  })

  it('resolves references that still exist', () => {
    const resolved = resolveReferences({
      request: request(),
      items: [item()],
      tags: [tag()],
      absolutePathOf: (name) => `/lib/${name}`,
    })
    expect(resolved).toEqual([
      {
        label: '@1',
        itemId: 'itm_1',
        title: 'Neon',
        kind: 'image',
        mimeType: 'image/png',
        absolutePath: '/lib/itm_1.png',
        uploadPath: '/lib/itm_1.png',
        uploadMimeType: 'image/png',
        mediaUrl: '/media/itm_1.png',
        sourceUrl: null,
        tags: ['Noir'],
        notes: '',
      },
    ])
  })

  it('places results next to their references or at the fallback', () => {
    const anchors = [{ position: { x: 0, y: 10 }, size: { width: 100, height: 50 } }]
    expect(
      resultPosition({ anchors, fallback: { x: 0, y: 0 }, index: 1, slotHeight: 100 }),
    ).toEqual({ x: 148, y: 110 })
    expect(
      resultPosition({ anchors: [], fallback: { x: 5, y: 5 }, index: 2, slotHeight: 10 }),
    ).toEqual({ x: 5, y: 25 })
  })

  it('edits drafts and only allows moving submitted requests', () => {
    const draft = { ...request(), status: 'draft' as const }
    const edited = updateDraft({
      request: draft,
      patch: {
        prompt: 'new',
        kind: 'video',
        model: 'kling3_0',
        aspectRatio: '9:16',
        count: 2,
        referenceItemIds: ['b', 'a'],
      },
      now: 'l',
    })
    expect(edited).toMatchObject({
      ok: true,
      value: {
        prompt: 'new',
        kind: 'video',
        model: 'kling3_0',
        aspectRatio: '9:16',
        count: 2,
        references: [
          { itemId: 'b', label: '@1' },
          { itemId: 'a', label: '@2' },
        ],
      },
    })
    const cleared = updateDraft({
      request: { ...draft, model: 'm', aspectRatio: '1:1' },
      patch: { model: null, aspectRatio: null },
      now: 'l',
    })
    expect(cleared).toMatchObject({ ok: true, value: { model: null, aspectRatio: null } })
    expect(
      updateDraft({ request: request(), patch: { position: { x: 1, y: 2 } }, now: 'l' }),
    ).toMatchObject({ ok: true, value: { position: { x: 1, y: 2 } } })
    expect(updateDraft({ request: request(), patch: { prompt: 'x' }, now: 'l' }).ok).toBe(false)
    expect(canTransition({ from: 'draft', to: 'pending' })).toBe(true)
    expect(canTransition({ from: 'draft', to: 'completed' })).toBe(false)
  })
})
