import { useEffect, useState } from 'react'

/** Live result of a CSS media query (re-renders when it flips, e.g. on rotate or resize). */
export function useMediaQuery(query) {
  const get = () => typeof window !== 'undefined' && window.matchMedia(query).matches
  const [matches, setMatches] = useState(get)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const on = () => setMatches(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [query])
  return matches
}

/** Phones (portrait or landscape), tablets and narrow windows get the bottom-sheet layout. */
export const useIsMobile = () => useMediaQuery('(max-width: 1023px), (max-height: 500px) and (pointer: coarse)')
/** Touch screens: no hover, no drag-and-drop. */
export const useIsTouch = () => useMediaQuery('(pointer: coarse)')
