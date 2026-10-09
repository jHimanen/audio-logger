export interface AudioInfo {
  file: string
  mime_type: string
  bytes: number
}

export interface TranscriptionInfo {
  provider: string
  model: string
  raw_text: string
  completed_at: string
}

export interface Note {
  id: string
  created_at: string
  language: string
  duration_ms: number
  audio: AudioInfo
  transcription: TranscriptionInfo | null
  processing: null
  edited_at: string | null
  text: string
}

/** Body of a 201 from POST /api/notes: the Note plus the absolute folder it was saved to. */
export interface NoteResponse extends Note {
  path: string
}

export type ErrorCode =
  | 'mic_denied'
  | 'mic_unavailable'
  | 'recorder_unsupported'
  | 'upload_failed'
  | 'transcription_failed'
  | 'too_large'
  | 'invalid_mime'
  | 'empty_audio'
  | 'validation_error'
  | 'server_error'
  | 'unknown'

export type RecorderState =
  | { status: 'idle' }
  | { status: 'recording'; startedAt: number }
  | { status: 'uploading' }
  | { status: 'transcribing' }
  | { status: 'done'; note: NoteResponse }
  | { status: 'error'; code: ErrorCode; path?: string }
