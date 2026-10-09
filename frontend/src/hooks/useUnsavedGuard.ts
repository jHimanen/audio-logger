import { useCallback, useEffect } from 'react'
import { t } from '../i18n'

/**
 * While `dirty`, closing or reloading the tab asks first. The returned `guard(action)` runs
 * an in-app action that would drop the draft, after a confirm if there is one.
 */
export function useUnsavedGuard(dirty: boolean): (action: () => void) => void {
  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  return useCallback(
    (action: () => void) => {
      if (!dirty || window.confirm(t('edit.discardConfirm'))) action()
    },
    [dirty],
  )
}
