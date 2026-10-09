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
import { useNotes } from './hooks/useNotes'
import { useRecorder } from './hooks/useRecorder'
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

  // A failed transcription still saves the audio, so reload on either outcome.
  useEffect(() => {
    if (finished) reload()
  }, [finished, reload])

  // Starting a recording closes the opened note so its transcript isn't shown under it.
  const toggleRecording = useCallback(() => {
    setSelected(null)
    toggle()
  }, [toggle])
  useHotkeys({ onToggle: toggleRecording, onCancel: cancel, onTogglePause: togglePause })

  const openNote = (note: NoteResponse) => {
    reset()
    setSelected(note)
  }

  return (
    <main>
      <h1>{t('app.title')}</h1>
      <p className="muted">{t('app.privacyNote')}</p>

      <div className="controls">
        <RecordButton status={state.status} onClick={toggleRecording} />
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
          <button type="button" className="secondary-button" onClick={reset}>
            {t('action.newRecording')}
          </button>
        )}
      </div>
      <ShortcutHints status={state.status} />

      <StatusMessage state={state} />
      {viewed && <TranscriptView note={viewed} />}

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
