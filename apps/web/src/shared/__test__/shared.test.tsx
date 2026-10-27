import { startTrace, type LogRecord } from '@inspiratio/shared'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Image } from 'lucide-react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import {
  apiError,
  createHttpClient,
  isApiRequestError,
  SERVER_DOWN_MESSAGE,
  startAction,
} from '../api/http-client.ts'
import { describeError, useCommand } from '../api/use-command.ts'
import { createBrowserLogger, installLogging, toRecord } from '../observability/logger.ts'
import {
  Dialog,
  ExternalLink,
  FilePicker,
  Kbd,
  Segmented,
  Select,
  Slider,
  TagChip,
  Tabs,
  ToastProvider,
} from '../ui/index.ts'

const silent = createBrowserLogger({
  service: 't',
  minLevel: 'error',
  ship: () => Promise.resolve(),
  echo: () => undefined,
  clock: () => 'now',
  maxBatch: 100,
})

const respond = (params: { readonly body: string; readonly status?: number }) => () =>
  Promise.resolve(new Response(params.body, { status: params.status ?? 200 }))

describe('http client', () => {
  it('sends a child span of the action trace and validates the payload', async () => {
    const fetchFn = vi.fn<typeof fetch>(respond({ body: '[1]' }))
    const client = createHttpClient({ fetchFn, logger: silent })
    const trace = startTrace()
    expect(
      await client.request({
        method: 'POST',
        path: '/x',
        body: { a: 1 },
        schema: z.array(z.number()),
        trace,
      }),
    ).toEqual([1])
    const headers = fetchFn.mock.calls[0]?.[1]?.headers as Record<string, string>
    expect(headers.traceparent).toContain(trace.traceId)
    expect(headers['content-type']).toBe('application/json')
  })

  it('throws typed API errors', async () => {
    const withBody = createHttpClient({
      fetchFn: respond({
        body: JSON.stringify({ error: { code: 'conflict', message: 'Taken', traceId: null } }),
        status: 409,
      }),
      logger: silent,
    })
    const error: unknown = await withBody
      .request({ method: 'GET', path: '/x', schema: z.unknown() })
      .catch((thrown: unknown) => thrown)
    expect(isApiRequestError(error) && error.code).toBe('conflict')
    const plain = createHttpClient({
      fetchFn: respond({ body: '<html>', status: 500 }),
      logger: silent,
    })
    await expect(plain.request({ method: 'GET', path: '/x', schema: z.unknown() })).rejects.toThrow(
      'Request failed (500)',
    )
    const invalid = createHttpClient({ fetchFn: respond({ body: '{"a":1}' }), logger: silent })
    await expect(
      invalid.request({ method: 'GET', path: '/x', schema: z.array(z.number()) }),
    ).rejects.toThrow('Unexpected response')
    expect(isApiRequestError(new Error('x'))).toBe(false)
  })

  it('reports a stopped server instead of a raw network error', async () => {
    const proxied = createHttpClient({
      fetchFn: respond({ body: '', status: 502 }),
      logger: silent,
    })
    const viaProxy: unknown = await proxied
      .request({ method: 'GET', path: '/x', schema: z.unknown() })
      .catch((thrown: unknown) => thrown)
    expect(isApiRequestError(viaProxy) && viaProxy.code).toBe('server_down')
    const unreachable = createHttpClient({
      fetchFn: () => Promise.reject(new TypeError('Failed to fetch')),
      logger: silent,
    })
    const direct: unknown = await unreachable
      .request({ method: 'POST', path: '/x', schema: z.unknown() })
      .catch((thrown: unknown) => thrown)
    expect(isApiRequestError(direct) && direct.message).toBe(SERVER_DOWN_MESSAGE)
  })

  it('describes errors for toasts', () => {
    expect(
      describeError(
        apiError({ message: 'Gone', code: 'not_found', status: 404, traceId: 'abcdef1234' }),
      ),
    ).toBe('Gone · trace abcdef12')
    expect(
      describeError(apiError({ message: 'Gone', code: 'not_found', status: 404, traceId: null })),
    ).toBe('Gone')
    expect(describeError(new Error('raw'))).toBe('raw')
    expect(describeError('text')).toBe('text')
    expect(startAction({ name: 'test' }).traceId).toHaveLength(32)
  })
})

describe('useCommand', () => {
  it('returns the result and invalidates queries', async () => {
    const client = new QueryClient()
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    const wrapper = ({ children }: { readonly children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )
    const { result } = renderHook(
      () =>
        useCommand({
          name: 'x',
          call: (input: { readonly n: number }) => Promise.resolve(input.n * 2),
          invalidate: [['board']],
          errorTitle: 'Failed',
        }),
      { wrapper },
    )
    expect(await result.current({ n: 2 })).toBe(4)
    await waitFor(() => {
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['board'] })
    })
  })
})

describe('browser logger', () => {
  it('builds records with the action trace', () => {
    const trace = startTrace()
    expect(
      toRecord({ level: 'info', service: 'web', ts: 'now', entry: { msg: 'm', trace, a: 1 } }),
    ).toMatchObject({
      traceId: trace.traceId,
      fields: { a: 1 },
    })
    expect(
      toRecord({ level: 'info', service: 'web', ts: 'now', entry: { msg: 'm' } }).traceId,
    ).toBeNull()
  })

  it('batches, flushes on errors and swallows shipping failures', async () => {
    const shipped: LogRecord[][] = []
    const echoed: string[] = []
    const logger = createBrowserLogger({
      service: 'web',
      minLevel: 'info',
      ship: (records) => {
        shipped.push([...records])
        return shipped.length === 2 ? Promise.reject(new Error('offline')) : Promise.resolve()
      },
      echo: (record) => echoed.push(record.msg),
      clock: () => 'now',
      maxBatch: 2,
    })
    logger.debug({ msg: 'skipped' })
    logger.info({ msg: 'a' })
    logger.warn({ msg: 'b' })
    logger.error({ msg: 'c' })
    await logger.flush()
    await logger.flush()
    expect(echoed).toEqual(['a', 'b', 'c'])
    expect(shipped.map((batch) => batch.map((record) => record.msg))).toEqual([['a', 'b'], ['c']])
  })

  it('captures global errors and flushes periodically', () => {
    vi.useFakeTimers()
    const target = window
    const dispose = installLogging({ target, intervalMs: 1000 })
    target.dispatchEvent(new ErrorEvent('error', { error: new Error('boom'), message: 'boom' }))
    const rejection = new Event('unhandledrejection') as PromiseRejectionEvent
    Object.defineProperty(rejection, 'reason', { value: 'nope' })
    target.dispatchEvent(rejection)
    target.dispatchEvent(new Event('pagehide'))
    vi.advanceTimersByTime(1000)
    dispose()
    vi.useRealTimers()
  })
})

describe('ui kit', () => {
  it('renders selects, sliders, segmented controls and tabs', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const onSlide = vi.fn()
    const onSegment = vi.fn()
    const onTab = vi.fn()
    render(
      <>
        <Select
          value="a"
          options={[
            { value: 'a', label: 'Alpha' },
            { value: 'b', label: 'Beta' },
          ]}
          onValueChange={onSelect}
          testId="select"
        />
        <Slider value={0} max={0} label="Volume" onValueChange={onSlide} testId="slider" />
        <Segmented
          value="x"
          options={[
            { value: 'x', label: 'X', icon: Image },
            { value: 'y', label: 'Y' },
          ]}
          onValueChange={onSegment}
        />
        <Tabs
          value="one"
          onValueChange={onTab}
          tabs={[
            { value: 'one', label: 'One', icon: Image, content: 'first' },
            { value: 'two', label: 'Two', icon: Image, badge: 3, content: 'second' },
          ]}
        />
        <TagChip name="ai" color="coral" system size="xs" />
        <Kbd>K</Kbd>
        <ExternalLink href="https://x.dev">x</ExternalLink>
      </>,
    )
    await user.click(screen.getByTestId('select'))
    await user.click(await screen.findByRole('option', { name: 'Beta' }))
    expect(onSelect).toHaveBeenCalledWith('b')
    fireEvent.change(screen.getByRole('slider'), { target: { value: '0.5' } })
    expect(onSlide).toHaveBeenCalled()
    await user.click(screen.getByTestId('segmented-y'))
    expect(onSegment).toHaveBeenCalledWith('y')
    await user.click(screen.getByTestId('segmented-y'))
    await user.click(screen.getByTestId('tab-two'))
    expect(onTab).toHaveBeenCalledWith('two')
    expect(screen.getByLabelText('system tag')).toBeInTheDocument()
  })

  it('renders dialogs, toasts and file pickers', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    const onFiles = vi.fn()
    render(
      <ToastProvider>
        <Dialog open onOpenChange={onOpenChange} title="Title" description="Desc">
          body
        </Dialog>
        <FilePicker label="Pick" icon={Image} accept="image/*" onFiles={onFiles} testId="picker" />
      </ToastProvider>,
    )
    expect(screen.getByText('Desc')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(onOpenChange).toHaveBeenCalledWith(false, expect.anything())
    await user.upload(screen.getByTestId('picker'), new File(['x'], 'a.png', { type: 'image/png' }))
    expect(onFiles).toHaveBeenCalledWith([expect.any(File)])
  })
})
