import { useEffect } from 'react'

interface Handlers {
  onToggle: () => void
  onCancel: () => void
}

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return (
    tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
  )
}

/** Space toggles recording, Escape cancels. Ignored while typing or when a button has focus. */
export function useHotkeys({ onToggle, onCancel }: Handlers): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || isEditable(e.target)) return
      // A focused button would also fire its own click on Space, double-toggling.
      if (e.target instanceof HTMLElement && e.target.tagName === 'BUTTON') return
      if (e.code === 'Space') {
        e.preventDefault()
        onToggle()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onToggle, onCancel])
}
