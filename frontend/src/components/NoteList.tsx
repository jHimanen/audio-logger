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

/** The note text on one line, or a muted hint when it has none. */
function Preview({ note }: { note: NoteResponse }) {
  const text = note.text.replace(/\s+/g, ' ').trim().slice(0, 120)
  if (text) return <span className="note-preview">{text}</span>
  return (
    <span className="note-preview muted">
      {note.transcription === null ? t('transcript.failed') : t('transcript.empty')}
    </span>
  )
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
              <Preview note={note} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
