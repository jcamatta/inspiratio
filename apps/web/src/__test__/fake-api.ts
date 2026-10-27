import type { GenerationRequest, Item, Section, Tag } from '@inspiratio/shared'

export const NOW = '2026-10-27T10:00:00.000Z'

export const makeItem = (overrides: Partial<Item> & { readonly id: string }): Item => ({
  kind: 'image',
  title: overrides.id,
  media: {
    fileName: `${overrides.id}.png`,
    mimeType: 'image/png',
    bytes: 2048,
    width: 640,
    height: 360,
  },
  position: { x: 0, y: 0 },
  size: { width: 320, height: 180 },
  zIndex: 1,
  sectionId: null,
  tagIds: [],
  metadata: {
    createdAt: NOW,
    updatedAt: NOW,
    origin: 'upload',
    sourceUrl: null,
    originalFileName: null,
    notes: '',
    generation: null,
  },
  ...overrides,
})

export const makeTag = (
  overrides: Partial<Tag> & { readonly id: string; readonly name: string },
): Tag => ({
  color: 'mint',
  system: false,
  createdAt: NOW,
  ...overrides,
})

export const makeSection = (overrides: Partial<Section> & { readonly id: string }): Section => ({
  title: 'Act I',
  position: { x: 0, y: 0 },
  size: { width: 640, height: 420 },
  color: 'mint',
  createdAt: NOW,
  updatedAt: NOW,
  ...overrides,
})

export const makeGeneration = (
  overrides: Partial<GenerationRequest> & { readonly id: string },
): GenerationRequest => ({
  prompt: 'A night street like @1',
  kind: 'image',
  model: null,
  aspectRatio: null,
  count: 1,
  references: [],
  status: 'pending',
  traceId: 'a'.repeat(32),
  createdAt: NOW,
  updatedAt: NOW,
  resultItemIds: [],
  error: null,
  position: { x: 600, y: 0 },
  size: null,
  progress: null,
  queuedAt: null,
  ...overrides,
})

export type RecordedRequest = {
  readonly method: string
  readonly path: string
  readonly body: unknown
  readonly traceparent: string | null
}

type State = {
  items: Item[]
  tags: Tag[]
  sections: Section[]
  generations: GenerationRequest[]
  trash: Item[]
}

const json = (params: { readonly body: unknown; readonly status?: number }): Response =>
  new Response(params.body === undefined ? null : JSON.stringify(params.body), {
    status: params.status ?? 200,
    headers: { 'content-type': 'application/json' },
  })

const noContent = (): Response => new Response(null, { status: 204 })

const apiError = (params: {
  readonly status: number
  readonly code: string
  readonly message: string
}): Response =>
  json({
    body: { error: { code: params.code, message: params.message, traceId: 'b'.repeat(32) } },
    status: params.status,
  })

/**
 * In-memory stand-in for the Inspiratio backend, implementing the endpoints the UI uses.
 * Tests seed it, drive the UI and assert on the recorded requests / resulting state.
 */
export const createFakeApi = (seed: Partial<State> = {}) => {
  const state: State = {
    items: [...(seed.items ?? [])],
    tags: [...(seed.tags ?? [])],
    sections: [...(seed.sections ?? [])],
    generations: [...(seed.generations ?? [])],
    trash: [],
  }
  const requests: RecordedRequest[] = []
  const failures = new Map<string, { status: number; message: string }>()
  let counter = 0
  const nextId = (prefix: string): string => {
    counter += 1
    return `${prefix}_new${counter}`
  }

  const route = (params: {
    readonly method: string
    readonly path: string
    readonly body: unknown
  }): Response => {
    const { method, path } = params
    const body = (params.body ?? {}) as Record<string, unknown>
    const [, , resource, id, action] = path.split('?')[0]?.split('/') ?? []
    const failure = failures.get(`${method} ${resource ?? ''}`)
    if (failure !== undefined) {
      failures.delete(`${method} ${resource ?? ''}`)
      return apiError({ status: failure.status, code: 'upstream', message: failure.message })
    }

    if (resource === 'logs') return noContent()
    if (resource === 'board' && method === 'GET')
      return json({ body: { items: state.items, tags: state.tags, sections: state.sections } })
    if (resource === 'generations' && method === 'GET' && id === undefined)
      return json({ body: state.generations })

    if (resource === 'items') {
      if (method === 'POST' && id === 'upload') {
        const files = params.body instanceof FormData ? params.body.getAll('files') : []
        const ids = files.map((file) => {
          const created = makeItem({
            id: nextId('itm'),
            title: file instanceof File ? file.name : 'file',
          })
          state.items.push(created)
          return created.id
        })
        return json({ body: { ids }, status: 201 })
      }
      if (method === 'POST' && id === 'import-url') {
        const created = makeItem({
          id: nextId('itm'),
          metadata: { ...makeItem({ id: 'x' }).metadata, sourceUrl: String(body.url) },
        })
        state.items.push(created)
        return json({ body: { id: created.id }, status: 201 })
      }
      if (method === 'POST' && id === 'layout') {
        const changes = body.changes as {
          id: string
          position?: Item['position']
          size?: Item['size']
          sectionId?: string | null
        }[]
        state.items = state.items.map((item) => {
          const change = changes.find((candidate) => candidate.id === item.id)
          return change === undefined
            ? item
            : {
                ...item,
                position: change.position ?? item.position,
                size: change.size ?? item.size,
                sectionId: change.sectionId === undefined ? item.sectionId : change.sectionId,
              }
        })
        return noContent()
      }
      if (method === 'POST' && action === 'restore') {
        const trashed = state.trash.find((candidate) => candidate.id === id)
        if (trashed === undefined)
          return apiError({ status: 404, code: 'not_found', message: 'gone' })
        state.trash = state.trash.filter((candidate) => candidate.id !== id)
        state.items.push(trashed)
        return noContent()
      }
      const item = state.items.find((candidate) => candidate.id === id)
      if (item === undefined)
        return apiError({ status: 404, code: 'not_found', message: `Item ${id ?? ''} not found` })
      const replace = (next: Item) => {
        state.items = state.items.map((candidate) => (candidate.id === item.id ? next : candidate))
      }
      if (method === 'PATCH') {
        replace({
          ...item,
          title: typeof body.title === 'string' ? body.title : item.title,
          zIndex: typeof body.zIndex === 'number' ? body.zIndex : item.zIndex,
          metadata: {
            ...item.metadata,
            notes: typeof body.notes === 'string' ? body.notes : item.metadata.notes,
            updatedAt: `${NOW}+${requests.length}`,
          },
        })
        return noContent()
      }
      if (method === 'PUT' && action === 'tags') {
        replace({
          ...item,
          tagIds: body.tagIds as string[],
          metadata: { ...item.metadata, updatedAt: `${NOW}+${requests.length}` },
        })
        return noContent()
      }
      if (method === 'PUT' && action === 'dimensions') {
        replace({
          ...item,
          media: { ...item.media, width: Number(body.width), height: Number(body.height) },
        })
        return noContent()
      }
      if (method === 'DELETE') {
        state.items = state.items.filter((candidate) => candidate.id !== item.id)
        state.trash.push(item)
        return noContent()
      }
    }

    if (resource === 'tags') {
      if (method === 'POST') {
        const name = String(body.name)
        const existing = state.tags.find((tag) => tag.name.toLowerCase() === name.toLowerCase())
        if (existing !== undefined) return json({ body: { id: existing.id }, status: 201 })
        const created = makeTag({ id: nextId('tag'), name })
        state.tags.push(created)
        return json({ body: { id: created.id }, status: 201 })
      }
      if (method === 'DELETE') {
        state.tags = state.tags.filter((tag) => tag.id !== id)
        return noContent()
      }
      if (method === 'PATCH') {
        state.tags = state.tags.map((tag) =>
          tag.id === id ? { ...tag, name: String(body.name) } : tag,
        )
        return noContent()
      }
    }

    if (resource === 'sections') {
      if (method === 'POST') {
        const created = makeSection({
          id: nextId('sec'),
          position: body.position as Section['position'],
        })
        state.sections.push(created)
        return json({ body: { id: created.id }, status: 201 })
      }
      if (method === 'PATCH') {
        state.sections = state.sections.map((section) =>
          section.id === id ? { ...section, ...(body as Partial<Section>) } : section,
        )
        return noContent()
      }
      if (method === 'DELETE') {
        state.sections = state.sections.filter((section) => section.id !== id)
        state.items = state.items.map((item) =>
          item.sectionId === id ? { ...item, sectionId: null } : item,
        )
        return noContent()
      }
    }

    if (resource === 'generations') {
      if (method === 'POST' && id === undefined) {
        const referenceItemIds = (body.referenceItemIds as string[] | undefined) ?? []
        const created = makeGeneration({
          id: nextId('gen'),
          prompt: typeof body.prompt === 'string' ? body.prompt : '',
          kind: body.kind === 'video' ? 'video' : 'image',
          model: typeof body.model === 'string' ? body.model : null,
          status: body.submit === false ? 'draft' : 'pending',
          position: (body.position as GenerationRequest['position'] | undefined) ?? {
            x: 600,
            y: 0,
          },
          size: (body.size as GenerationRequest['size'] | undefined) ?? null,
          references: [...referenceItemIds.entries()].map(([index, itemId]) => ({
            itemId,
            label: `@${String(index + 1)}`,
          })),
        })
        state.generations.unshift(created)
        return json({ body: { id: created.id }, status: 201 })
      }
      const found = state.generations.find((request) => request.id === id)
      const replace = (next: GenerationRequest) => {
        state.generations = state.generations.map((request) =>
          request.id === next.id ? next : request,
        )
      }
      if (method === 'PATCH' && found !== undefined) {
        const ids = body.referenceItemIds as string[] | undefined
        replace({
          ...found,
          ...(typeof body.prompt === 'string' ? { prompt: body.prompt } : {}),
          ...(body.kind === 'image' || body.kind === 'video' ? { kind: body.kind } : {}),
          ...('model' in body ? { model: body.model as string | null } : {}),
          ...('aspectRatio' in body ? { aspectRatio: body.aspectRatio as string | null } : {}),
          ...(typeof body.count === 'number' ? { count: body.count } : {}),
          ...(body.position === undefined
            ? {}
            : { position: body.position as GenerationRequest['position'] }),
          ...('size' in body ? { size: body.size as GenerationRequest['size'] } : {}),
          ...(ids === undefined
            ? {}
            : {
                references: [...ids.entries()].map(([index, itemId]) => ({
                  itemId,
                  label: `@${String(index + 1)}`,
                })),
              }),
        })
        return noContent()
      }
      if (method === 'POST' && action === 'submit' && found !== undefined) {
        if (found.prompt.trim() === '')
          return apiError({
            status: 400,
            code: 'validation',
            message: 'Write a prompt before generating',
          })
        replace({ ...found, status: 'pending', queuedAt: NOW })
        return json({ body: { id: found.id } })
      }
      if (method === 'POST' && action === 'retry') {
        state.generations = state.generations.map((request) =>
          request.id === id ? { ...request, status: 'pending', error: null } : request,
        )
        return noContent()
      }
      if (method === 'DELETE') {
        state.generations = state.generations.filter((request) => request.id !== id)
        return noContent()
      }
    }
    return apiError({
      status: 404,
      code: 'not_found',
      message: `No fake route for ${method} ${path}`,
    })
  }

  const fetchFn = async (...[input, init]: Parameters<typeof fetch>): Promise<Response> => {
    const path =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.pathname + input.search
          : input.url
    const method = (init?.method ?? 'GET').toUpperCase()
    const raw = init?.body
    const body: unknown =
      raw instanceof FormData ? raw : typeof raw === 'string' ? JSON.parse(raw) : undefined
    const headers = new Headers(init?.headers)
    if (!path.startsWith('/api/logs'))
      requests.push({ method, path, body, traceparent: headers.get('traceparent') })
    await Promise.resolve()
    return route({ method, path, body })
  }

  return {
    state,
    requests,
    fetch: fetchFn,
    /** Makes the next request of `method` on `/api/<resource>` fail with an API error. */
    failNext: (params: {
      readonly method: string
      readonly resource: string
      readonly status?: number
      readonly message?: string
    }) => {
      failures.set(`${params.method} ${params.resource}`, {
        status: params.status ?? 500,
        message: params.message ?? 'Boom',
      })
    },
    requestsTo: (params: { readonly method: string; readonly path: string }) =>
      requests.filter(
        (request) => request.method === params.method && request.path === params.path,
      ),
  }
}

export type FakeApi = ReturnType<typeof createFakeApi>
