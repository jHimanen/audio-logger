import { dateFormat, formatDuration } from '../format'
import { t } from '../i18n'
import type { ErrorCode, NoteResponse } from '../types'

interface Props {
  notes: NoteResponse[]
  error: ErrorCode | null
  selectedId: string | null
  onSelect: (note: NoteResponse) => void
  disabled: boolean
}

function preview(note: NoteResponse): string {
  if (note.transcription === null) return t('transcript.failed')
  return note.text.replace(/\s+/g, ' ').trim().slice(0, 120) || t('transcript.empty')
}

export function NoteList({ notes, error, selectedId, onSelect, disabled }: Props) {
  return (
    <section className="notes">
      <h2>{t('notes.title')}</h2>
      {error && (
        <p className="status error" role="alert">
          {t(`error.${error}`, { path: '' })}
        </p>
      )}
      {!error && notes.length === 0 && <p className="muted">{t('notes.empty')}</p>}
      <ul className="note-list">
        {notes.map((note) => (
          <li key={note.id}>
            <button
              type="button"
              className="note-item"
              onClick={() => onSelect(note)}
              disabled={disabled}
              aria-current={note.id === selectedId}
            >
              <span className="muted">
                {dateFormat.format(new Date(note.created_at))} ·{' '}
                {formatDuration(note.duration_ms)}
              </span>
              <span className={note.transcription === null ? 'note-preview muted' : 'note-preview'}>
                {preview(note)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
