import type { NoteResponse } from '../types'

export function makeNote(overrides: Partial<NoteResponse> = {}): NoteResponse {
  return {
    id: '2026-10-09T12-00-00Z',
    created_at: '2026-10-09T12:00:00Z',
    language: 'fi',
    duration_ms: 1000,
    audio: { file: 'audio.webm', mime_type: 'audio/webm', bytes: 10 },
    transcription: {
      provider: 'fake',
      model: 'fake',
      raw_text: 'raaka',
      completed_at: '2026-10-09T12:00:01Z',
    },
    processing: null,
    edited_at: null,
    text: 'raaka',
    path: '/notes/2026-10-09T12-00-00Z',
    ...overrides,
  }
}
