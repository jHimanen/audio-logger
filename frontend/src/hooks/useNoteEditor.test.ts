import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, updateNote } from '../api'
import { makeNote } from '../test/note'
import type { NoteResponse } from '../types'
import { useNoteEditor } from './useNoteEditor'

vi.mock('../api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api')>()),
  updateNote: vi.fn(),
}))

const update = vi.mocked(updateNote)

function setup(note: NoteResponse | null = makeNote()) {
  const onSaved = vi.fn()
  const hook = renderHook(({ n }) => useNoteEditor(n, onSaved), { initialProps: { n: note } })
  return { ...hook, onSaved }
}

beforeEach(() => {
  update.mockReset()
})

describe('useNoteEditor', () => {
  it('is dirty only while the draft differs from the note', () => {
    const { result } = setup()
    expect(result.current.text).toBe('raaka')
    expect(result.current.dirty).toBe(false)
    act(() => result.current.setText('muokattu'))
    expect(result.current.dirty).toBe(true)
    act(() => result.current.setText('raaka'))
    expect(result.current.dirty).toBe(false)
  })

  it('saves the draft and shows the saved note', async () => {
    const saved = makeNote({ text: 'muokattu', edited_at: '2026-10-09T13:00:00Z' })
    update.mockResolvedValue(saved)
    const { result, onSaved } = setup()
    act(() => result.current.setText('muokattu'))
    await act(() => result.current.save())
    expect(update).toHaveBeenCalledExactlyOnceWith(saved.id, 'muokattu')
    expect(onSaved).toHaveBeenCalledWith(saved)
    expect(result.current.dirty).toBe(false)
    expect(result.current.text).toBe('muokattu')
    expect(result.current.editedAt).toBe(saved.edited_at)
  })

  it('does not save when clean', async () => {
    const { result } = setup()
    await act(() => result.current.save())
    expect(update).not.toHaveBeenCalled()
  })

  it('keeps the draft and reports the error when saving fails', async () => {
    update.mockRejectedValue(new ApiError('not_found'))
    const { result, onSaved } = setup()
    act(() => result.current.setText('muokattu'))
    await act(() => result.current.save())
    expect(result.current.error).toBe('not_found')
    expect(result.current.dirty).toBe(true)
    expect(result.current.text).toBe('muokattu')
    expect(onSaved).not.toHaveBeenCalled()
  })

  it('restores the raw transcript as an unsaved draft', () => {
    const { result } = setup(makeNote({ text: 'muokattu' }))
    expect(result.current.canRestore).toBe(true)
    act(() => result.current.restore())
    expect(result.current.text).toBe('raaka')
    expect(result.current.dirty).toBe(true)
    expect(result.current.canRestore).toBe(false)
  })

  it('cannot restore a note without a transcription', () => {
    const { result } = setup(makeNote({ transcription: null, text: '' }))
    expect(result.current.canRestore).toBe(false)
  })

  it('drops the draft when another note is shown', () => {
    const { result, rerender } = setup()
    act(() => result.current.setText('muokattu'))
    rerender({ n: makeNote({ id: 'other', text: 'toinen' }) })
    expect(result.current.text).toBe('toinen')
    expect(result.current.dirty).toBe(false)
  })

  it('is empty and clean without a note', () => {
    const { result } = setup(null)
    expect(result.current.text).toBe('')
    expect(result.current.dirty).toBe(false)
    expect(result.current.canRestore).toBe(false)
  })
})
