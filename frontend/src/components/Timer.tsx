import { useEffect, useState } from 'react'
import { formatDuration } from '../format'

interface Props {
  /** performance.now() at the moment recording started, shifted forward by any pauses. */
  startedAt: number
}

export function Timer({ startedAt }: Props) {
  const [elapsed, setElapsed] = useState(() => performance.now() - startedAt)

  useEffect(() => {
    const id = setInterval(() => setElapsed(performance.now() - startedAt), 250)
    return () => clearInterval(id)
  }, [startedAt])

  return (
    <span className="timer">
      {formatDuration(elapsed)}
    </span>
  )
}
