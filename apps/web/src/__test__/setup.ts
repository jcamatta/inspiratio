import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  stubBrowserApis()
})

/** jsdom lacks these browser APIs used by React Flow, Base UI and the video player. */
const stubBrowserApis = (): void => {
  vi.stubGlobal(
    'ResizeObserver',
    vi.fn(function ResizeObserverStub() {
      return { observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn() }
    }),
  )
  vi.stubGlobal(
    'DOMMatrixReadOnly',
    vi.fn(function DOMMatrixStub() {
      return { m22: 1, a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }
    }),
  )
}

stubBrowserApis()

Object.defineProperty(navigator, 'clipboard', {
  value: { writeText: vi.fn(() => Promise.resolve()) },
  configurable: true,
})

Object.defineProperty(HTMLMediaElement.prototype, 'play', {
  configurable: true,
  value: vi.fn(function play(this: HTMLMediaElement) {
    this.dispatchEvent(new Event('play'))
    return Promise.resolve()
  }),
})

Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
  configurable: true,
  value: vi.fn(function pause(this: HTMLMediaElement) {
    this.dispatchEvent(new Event('pause'))
  }),
})

Object.defineProperty(Element.prototype, 'getAnimations', {
  configurable: true,
  value: () => [],
})
