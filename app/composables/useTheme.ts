export type Theme = 'light' | 'dark'

export const THEME_KEY = 'yalp-theme'

/**
 * Explicit day/night switch, layered over the system preference.
 *
 * No stored value means "follow the system", which is the right default —
 * someone who has set their phone to dark at night should not have to
 * tell this site as well. The button records an explicit choice only when
 * they actually disagree with it.
 */
export function useTheme() {
  /** What the page is showing right now, system preference included. */
  function current(): Theme {
    const attr = document.documentElement.getAttribute('data-theme')
    if (attr === 'dark' || attr === 'light') return attr
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }

  function set(theme: Theme) {
    document.documentElement.setAttribute('data-theme', theme)
    // Browser storage can throw in a private window; a theme choice is
    // not worth breaking the page over.
    try { localStorage.setItem(THEME_KEY, theme) } catch { /* ignore */ }
  }

  function toggle() {
    set(current() === 'dark' ? 'light' : 'dark')
  }

  return { current, set, toggle }
}
