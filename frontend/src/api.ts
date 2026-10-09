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

export async function fetchConfig(): Promise<{ locale: string }> {
  const res = await fetch('/api/config')
  if (!res.ok) throw new ApiError('server_error')
  return res.json() as Promise<{ locale: string }>
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
      if (xhr.status === 201) {
        resolve(JSON.parse(xhr.responseText) as NoteResponse)
      } else {
        reject(errorFromResponse(xhr.status, xhr.responseText))
      }
    }
    xhr.onerror = () => reject(new ApiError('upload_failed'))
    xhr.onabort = () => reject(new ApiError('upload_failed'))
    xhr.send(form)
  })
}
