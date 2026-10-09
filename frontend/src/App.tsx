import { RecordButton } from './components/RecordButton'
import { StatusMessage } from './components/StatusMessage'
import { Timer } from './components/Timer'
import { TranscriptView } from './components/TranscriptView'
import { useHotkeys } from './hooks/useHotkeys'
import { useRecorder } from './hooks/useRecorder'
import { t } from './i18n'

export default function App() {
  const { state, toggle, cancel, reset } = useRecorder()
  useHotkeys({ onToggle: toggle, onCancel: cancel })

  const finished = state.status === 'done' || state.status === 'error'

  return (
    <main>
      <h1>{t('app.title')}</h1>
      <p className="muted">{t('app.privacyNote')}</p>

      <div className="controls">
        <RecordButton status={state.status} onClick={toggle} />
        {state.status === 'recording' && <Timer startedAt={state.startedAt} />}
        {finished && (
          <button type="button" className="secondary-button" onClick={reset}>
            {t('action.newRecording')}
          </button>
        )}
      </div>
      <p className="muted">{t('record.hint')}</p>

      <StatusMessage state={state} />
      {state.status === 'done' && <TranscriptView note={state.note} />}
    </main>
  )
}
