import { t, type MessageKey } from '../i18n'
import type { RecorderState } from '../types'

interface Props {
  status: RecorderState['status']
}

const HINTS: Partial<Record<RecorderState['status'], MessageKey>> = {
  idle: 'hint.idle',
  recording: 'hint.recording',
  paused: 'hint.paused',
}

/** Keyboard hints for the current state. `[Key]` in a message renders as <kbd>. */
export function ShortcutHints({ status }: Props) {
  const key = HINTS[status]
  if (!key) return null
  // split with a capture group puts the bracketed key names at odd indices.
  const parts = t(key).split(/\[([^\]]+)\]/)
  return (
    <p className="muted hints">
      {parts.map((part, i) => (i % 2 ? <kbd key={i}>{part}</kbd> : part))}
    </p>
  )
}
