import { useEffect } from 'react'

interface Handlers {
  onToggle: () => void
  onCancel: () => void
  onTogglePause: () => void
}

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return (
    // A focused <audio controls> handles Space itself (play/pause).
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    tag === 'AUDIO' ||
    target.isContentEditable
  )
}

/**
 * Space toggles recording, P pauses/resumes, Escape cancels. Ignored while typing in an
 * editable element.
 */
export function useHotkeys({ onToggle, onCancel, onTogglePause }: Handlers): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || isEditable(e.target)) return
      if (e.code === 'Space') {
        // The focused record button fires its own click on Space; let that be the toggle.
        // On any other focused button, preventDefault stops Space from clicking it, so Space
        // always does what the hint says.
        if (e.target instanceof HTMLElement && e.target.closest('.record-button')) return
        e.preventDefault()
        onToggle()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
      } else if (e.key.toLowerCase() === 'p' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        // e.key, not e.code, so the hint matches the printed key on any layout.
        e.preventDefault()
        onTogglePause()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onToggle, onCancel, onTogglePause])
}
