import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useUnsavedGuard } from './useUnsavedGuard'

afterEach(() => vi.restoreAllMocks())

describe('useUnsavedGuard', () => {
  it('runs the action without asking when clean', () => {
    const confirm = vi.spyOn(window, 'confirm')
    const action = vi.fn()
    renderHook(() => useUnsavedGuard(false)).result.current(action)
    expect(confirm).not.toHaveBeenCalled()
    expect(action).toHaveBeenCalledOnce()
  })

  it('asks first when dirty and runs the action only on OK', () => {
    const confirm = vi
      .spyOn(window, 'confirm')
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true)
    const action = vi.fn()
    const guard = renderHook(() => useUnsavedGuard(true)).result.current
    guard(action)
    expect(action).not.toHaveBeenCalled()
    guard(action)
    expect(action).toHaveBeenCalledOnce()
    expect(confirm).toHaveBeenCalledTimes(2)
  })

  it('blocks unload only while dirty', () => {
    const { rerender } = renderHook(({ dirty }) => useUnsavedGuard(dirty), {
      initialProps: { dirty: true },
    })
    const event = () => {
      const e = new Event('beforeunload', { cancelable: true })
      window.dispatchEvent(e)
      return e.defaultPrevented
    }
    expect(event()).toBe(true)
    rerender({ dirty: false })
    expect(event()).toBe(false)
  })
})
