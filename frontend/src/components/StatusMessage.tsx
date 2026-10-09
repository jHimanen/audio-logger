import { t } from '../i18n'
import type { RecorderState } from '../types'

interface Props {
  state: RecorderState
}

export function StatusMessage({ state }: Props) {
  switch (state.status) {
    case 'recording':
      return <p className="status">{t('status.recording')}</p>
    case 'uploading':
      return <p className="status">{t('status.uploading')}</p>
    case 'transcribing':
      return <p className="status">{t('status.transcribing')}</p>
    case 'error':
      return (
        <p className="status error" role="alert">
          {t(`error.${state.code}`, { path: state.path ?? '' })}
        </p>
      )
    case 'idle':
    case 'done':
      return null
  }
}
