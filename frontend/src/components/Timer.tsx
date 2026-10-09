import { useEffect, useState } from 'react'

interface Props {
  /** performance.now() at the moment recording started. */
  startedAt: number
}

function format(ms: number): string {
  const total = Math.floor(ms / 1000)
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function Timer({ startedAt }: Props) {
  const [elapsed, setElapsed] = useState(() => performance.now() - startedAt)

  useEffect(() => {
    const id = setInterval(() => setElapsed(performance.now() - startedAt), 250)
    return () => clearInterval(id)
  }, [startedAt])

  return (
    <span className="timer" aria-live="off">
      {format(elapsed)}
    </span>
  )
}
