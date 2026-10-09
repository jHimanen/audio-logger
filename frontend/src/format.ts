import { t } from './i18n'

/** m:ss, e.g. 1:05. */
export function formatDuration(ms: number): string {
  const total = Math.floor(ms / 1000)
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export const dateFormat = new Intl.DateTimeFormat(t('intl.locale'), {
  dateStyle: 'medium',
  timeStyle: 'short',
})
