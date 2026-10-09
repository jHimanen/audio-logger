import { audioUrl } from '../api'
import { formatDuration } from '../format'
import { t } from '../i18n'
import type { NoteResponse } from '../types'

interface Props {
  note: NoteResponse
}

export function TranscriptView({ note }: Props) {
  const text = note.text.trim()
  return (
    <section className="transcript">
      <h2>{t('transcript.title')}</h2>
      <div className="playback">
        <audio
          controls
          preload="none"
          src={audioUrl(note.id)}
          aria-label={t('transcript.audio')}
        />
        <span className="timer">{formatDuration(note.duration_ms)}</span>
      </div>
      {note.transcription === null ? (
        <p className="muted">{t('transcript.failed')}</p>
      ) : text ? (
        <p className="transcript-text">{text}</p>
      ) : (
        <p className="muted">{t('transcript.empty')}</p>
      )}
      <p className="muted saved-to">{t('transcript.savedTo', { path: note.path })}</p>
    </section>
  )
}
