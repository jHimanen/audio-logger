import { audioUrl } from '../api'
import { dateFormat, formatDuration } from '../format'
import type { NoteEditor } from '../hooks/useNoteEditor'
import { t } from '../i18n'
import type { NoteResponse } from '../types'

interface Props {
  note: NoteResponse
  editor: NoteEditor
  disabled: boolean
}

export function TranscriptView({ note, editor, disabled }: Props) {
  const hint = editor.text.trim()
    ? null
    : note.transcription === null
      ? t('transcript.failed')
      : t('transcript.empty')
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
      {hint && <p className="muted">{hint}</p>}
      <textarea
        className="transcript-text"
        value={editor.text}
        onChange={(e) => editor.setText(e.target.value)}
        disabled={disabled}
        aria-label={t('edit.textarea')}
      />
      <div className="editor-actions">
        <button
          type="button"
          className="secondary-button"
          onClick={() => void editor.save()}
          disabled={disabled || !editor.dirty || editor.saving}
        >
          {editor.saving ? t('edit.saving') : t('edit.save')}
        </button>
        {editor.canRestore && (
          <button
            type="button"
            className="secondary-button"
            onClick={editor.restore}
            disabled={disabled}
          >
            {t('edit.restore')}
          </button>
        )}
        {editor.editedAt && (
          <span className="muted">
            {t('edit.editedAt', { date: dateFormat.format(new Date(editor.editedAt)) })}
          </span>
        )}
      </div>
      {editor.error && (
        <p className="status error" role="alert">
          {t(`error.${editor.error}`, { path: '' })}
        </p>
      )}
      <p className="muted saved-to">{t('transcript.savedTo', { path: note.path })}</p>
    </section>
  )
}
