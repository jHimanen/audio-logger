import type { ErrorCode, NoteResponse } from './types'

export class ApiError extends Error {
  readonly code: ErrorCode
  readonly path?: string

  constructor(code: ErrorCode, path?: string) {
    super(code)
    this.code = code
    this.path = path
  }
}

const SERVER_CODES: ReadonlySet<string> = new Set<ErrorCode>([
  'transcription_failed',
  'too_large',
  'invalid_mime',
  'empty_audio',
  'validation_error',
  'not_found',
])

function errorFromResponse(status: number, body: string): ApiError {
  let code: string | undefined
  let path: string | undefined
  try {
    const parsed = JSON.parse(body) as { error?: { code?: string; path?: string } }
    code = parsed.error?.code
    path = parsed.error?.path
  } catch {
    // Non-JSON body (proxy error page, etc.); fall through to a generic code.
  }
  if (code && SERVER_CODES.has(code)) return new ApiError(code as ErrorCode, path)
  return new ApiError(status >= 500 ? 'server_error' : 'unknown')
}

/** fetch that throws ApiError on a network failure or a non-2xx response. */
async function send(url: string, init?: RequestInit): Promise<Response> {
  let res: Response
  try {
    res = await fetch(url, init)
  } catch {
    throw new ApiError('server_error')
  }
  if (!res.ok) throw errorFromResponse(res.status, await res.text())
  return res
}

export async function fetchConfig(): Promise<{ locale: string }> {
  const res = await fetch('/api/config')
  if (!res.ok) throw new ApiError('server_error')
  return res.json() as Promise<{ locale: string }>
}

/** All saved notes, newest first. */
export async function fetchNotes(): Promise<NoteResponse[]> {
  const res = await send('/api/notes')
  return res.json() as Promise<NoteResponse[]>
}

/** Replaces the note's text; resolves with the updated note. */
export async function updateNote(id: string, text: string): Promise<NoteResponse> {
  const res = await send(`/api/notes/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  return res.json() as Promise<NoteResponse>
}

/** Deletes the note and its audio. */
export async function deleteNote(id: string): Promise<void> {
  await send(`/api/notes/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export function audioUrl(id: string): string {
  return `/api/notes/${encodeURIComponent(id)}/audio`
}

/**
 * Uploads a recording. `onUploaded` fires once the request body has been fully sent, i.e.
 * the server is now transcribing; the promise resolves with the saved note.
 * XMLHttpRequest because fetch has no upload-complete signal.
 */
export function createNote(
  audio: Blob,
  mimeType: string,
  durationMs: number,
  onUploaded?: () => void,
): Promise<NoteResponse> {
  const form = new FormData()
  form.append('audio', audio, 'audio.webm')
  form.append('mime_type', mimeType)
  form.append('duration_ms', String(durationMs))

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/notes')
    xhr.upload.onload = () => onUploaded?.()
    xhr.onload = () => {
      if (xhr.status !== 201) {
        reject(errorFromResponse(xhr.status, xhr.responseText))
        return
      }
      try {
        resolve(JSON.parse(xhr.responseText) as NoteResponse)
      } catch {
        reject(new ApiError('unknown'))
      }
    }
    xhr.onerror = () => reject(new ApiError('upload_failed'))
    xhr.onabort = () => reject(new ApiError('upload_failed'))
    xhr.send(form)
  })
}
