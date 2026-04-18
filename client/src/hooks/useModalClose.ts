import { useEffect } from 'react'

/**
 * Hook that calls `onClose` when the user presses Escape.
 * Attach to any modal component to get consistent keyboard dismissal.
 */
export function useModalClose(onClose: () => void) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])
}
