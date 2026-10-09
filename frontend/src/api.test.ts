import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, deleteNote, updateNote } from './api'
import { makeNote } from './test/note'

function respond(status: number, body?: unknown) {
  const fetch = vi.fn().mockResolvedValue(
    new Response(body === undefined ? null : JSON.stringify(body), { status }),
  )
  vi.stubGlobal('fetch', fetch)
  return fetch
}

const notFound = { error: { code: 'not_found', message: 'No note', note_id: 'x' } }

afterEach(() => vi.unstubAllGlobals())

describe('updateNote', () => {
  it('PUTs the text as JSON and returns the note', async () => {
    const note = makeNote({ text: 'moi' })
    const fetch = respond(200, note)
    await expect(updateNote('a b', 'moi')).resolves.toEqual(note)
    expect(fetch).toHaveBeenCalledWith('/api/notes/a%20b', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: '{"text":"moi"}',
    })
  })

  it('throws the server error code', async () => {
    respond(404, notFound)
    await expect(updateNote('x', 'moi')).rejects.toEqual(new ApiError('not_found'))
  })

  it('throws server_error when the server is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await expect(updateNote('x', 'moi')).rejects.toMatchObject({ code: 'server_error' })
  })
})

describe('deleteNote', () => {
  it('resolves on 204', async () => {
    const fetch = respond(204)
    await expect(deleteNote('x')).resolves.toBeUndefined()
    expect(fetch).toHaveBeenCalledWith('/api/notes/x', { method: 'DELETE' })
  })

  it('throws not_found on 404', async () => {
    respond(404, notFound)
    await expect(deleteNote('x')).rejects.toMatchObject({ code: 'not_found' })
  })
})
