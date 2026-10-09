import { t } from '../i18n'
import type { RecorderState } from '../types'

interface Props {
  status: RecorderState['status']
  onClick: () => void
}

export function RecordButton({ status, onClick }: Props) {
  const recording = status === 'recording' || status === 'paused'
  return (
    <button
      type="button"
      className={recording ? `record-button ${status}` : 'record-button'}
      onClick={onClick}
      disabled={status !== 'idle' && !recording}
      aria-pressed={recording}
    >
      {recording ? t('record.stop') : t('record.start')}
    </button>
  )
}
