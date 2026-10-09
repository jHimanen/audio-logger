import { LevelMeter } from './components/LevelMeter'
import { RecordButton } from './components/RecordButton'
import { ShortcutHints } from './components/ShortcutHints'
import { StatusMessage } from './components/StatusMessage'
import { Timer } from './components/Timer'
import { TranscriptView } from './components/TranscriptView'
import { formatDuration } from './format'
import { useHotkeys } from './hooks/useHotkeys'
import { useRecorder } from './hooks/useRecorder'
import { t } from './i18n'

export default function App() {
  const { state, stream, toggle, cancel, togglePause, reset } = useRecorder()
  useHotkeys({ onToggle: toggle, onCancel: cancel, onTogglePause: togglePause })

  const finished = state.status === 'done' || state.status === 'error'
  const active = state.status === 'recording' || state.status === 'paused'

  return (
    <main>
      <h1>{t('app.title')}</h1>
      <p className="muted">{t('app.privacyNote')}</p>

      <div className="controls">
        <RecordButton status={state.status} onClick={toggle} />
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
      {state.status === 'done' && <TranscriptView note={state.note} />}
    </main>
  )
}
