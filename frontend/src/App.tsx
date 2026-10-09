import { useCallback, useEffect, useState } from 'react'
import { LevelMeter } from './components/LevelMeter'
import { NoteList } from './components/NoteList'
import { RecordButton } from './components/RecordButton'
import { ShortcutHints } from './components/ShortcutHints'
import { StatusMessage } from './components/StatusMessage'
import { Timer } from './components/Timer'
import { TranscriptView } from './components/TranscriptView'
import { formatDuration } from './format'
import { useHotkeys } from './hooks/useHotkeys'
import { useNoteEditor } from './hooks/useNoteEditor'
import { useNotes } from './hooks/useNotes'
import { useRecorder } from './hooks/useRecorder'
import { useUnsavedGuard } from './hooks/useUnsavedGuard'
import { t } from './i18n'
import type { NoteResponse } from './types'

export default function App() {
  const { state, stream, toggle, cancel, togglePause, reset } = useRecorder()
  const { notes, error: notesError, reload } = useNotes()
  const [selected, setSelected] = useState<NoteResponse | null>(null)

  const finished = state.status === 'done' || state.status === 'error'
  const active = state.status === 'recording' || state.status === 'paused'
  const busy = state.status !== 'idle' && !finished
  const viewed = state.status === 'done' ? state.note : selected

  // A failed transcription still saves the audio, so it belongs in the list too.
  const saved =
    state.status === 'done' ||
    (state.status === 'error' && state.code === 'transcription_failed')
  useEffect(() => {
    if (saved) reload()
  }, [saved, reload])

  // An opened note must not show under a live recording, however the recording started.
  // Adjusted during render (not in an effect) when `active` flips.
  const [wasActive, setWasActive] = useState(active)
  if (active !== wasActive) {
    setWasActive(active)
    if (active) setSelected(null)
  }

  // The editor shows its own saved copy, so `viewed` is left as is; only the list reloads.
  const editor = useNoteEditor(viewed, reload, (id) => {
    // The user may have opened another note while the delete was in flight.
    setSelected((s) => (s?.id === id ? null : s))
    reset()
    reload()
  })

  // Starting a recording, opening another note or "Uusi äänitys" all drop the draft.
  const guard = useUnsavedGuard(editor.dirty)
  const idle = state.status === 'idle'
  const guardedToggle = useCallback(() => (idle ? guard(toggle) : toggle()), [idle, guard, toggle])

  useHotkeys({ onToggle: guardedToggle, onCancel: cancel, onTogglePause: togglePause })

  const openNote = (note: NoteResponse) => {
    if (note.id === viewed?.id) return
    guard(() => {
      reset()
      setSelected(note)
    })
  }

  return (
    <main>
      <h1>{t('app.title')}</h1>
      <p className="muted">{t('app.privacyNote')}</p>

      <div className="controls">
        <RecordButton status={state.status} onClick={guardedToggle} />
        {state.status === 'recording' && <Timer startedAt={state.startedAt} />}
        {state.status === 'paused' && (
          <span className="timer">{formatDuration(state.elapsedMs)}</span>
        )}
        {active && (
          <button
            type="button"
            className="secondary-button"
            onClick={togglePause}
            aria-pressed={state.status === 'paused'}
          >
            {state.status === 'paused' ? t('record.resume') : t('record.pause')}
          </button>
        )}
        {active && stream && <LevelMeter stream={stream} paused={state.status === 'paused'} />}
        {finished && (
          <button type="button" className="secondary-button" onClick={() => guard(reset)}>
            {t('action.newRecording')}
          </button>
        )}
      </div>
      <ShortcutHints status={state.status} />

      <StatusMessage state={state} />
      {viewed && <TranscriptView
          note={viewed}
          editor={editor}
          disabled={busy}
          onDelete={() => {
            // Deleting also drops any draft; this confirm covers both.
            if (window.confirm(t('edit.deleteConfirm'))) void editor.remove()
          }}
        />}

      <NoteList
        notes={notes}
        error={notesError}
        selectedId={viewed?.id ?? null}
        onSelect={openNote}
        disabled={busy}
      />
    </main>
  )
}
