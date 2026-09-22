/**
 * Who is signed in, shared across every component on the page.
 *
 * `useState` rather than a module-level ref: on the server each request
 * needs its own value, and a module-level ref would be shared between
 * visitors — the classic SSR data leak.
 */
export interface Me { id: string; email: string; name: string }

export function useAuth() {
  const user = useState<Me | null>('auth-user', () => null)
  /** False when the site is running with no database behind it. */
  const enabled = useState<boolean>('auth-enabled', () => false)
  const loaded = useState<boolean>('auth-loaded', () => false)

  async function refresh() {
    try {
      const res = await $fetch<{ user: Me | null; enabled: boolean }>('/api/auth/me')
      user.value = res.user
      enabled.value = res.enabled
    } catch {
      // A static build has no /api/auth/me at all. That is not an error
      // worth showing anyone — it just means the write side is absent.
      user.value = null
      enabled.value = false
    } finally {
      loaded.value = true
    }
  }

  async function logout() {
    await $fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
    user.value = null
  }

  /**
   * The same answer, but resolved during server rendering.
   *
   * `refresh` runs from onMounted, which is fine for a header chip that
   * can appear a moment late. It is wrong for a page whose whole content
   * depends on the answer: the server would render the "unavailable"
   * branch, and a crawler — or anyone with JavaScript off — would never
   * see anything else. `useFetch` runs on both sides and transfers its
   * result in the payload, so the first paint is already correct.
   */
  async function ensure() {
    const { data } = await useFetch<{ user: Me | null; enabled: boolean }>('/api/auth/me', {
      key: 'auth-me',
      default: () => ({ user: null, enabled: false }),
    })
    user.value = data.value?.user ?? null
    enabled.value = data.value?.enabled ?? false
    loaded.value = true
    return data
  }

  return { user, enabled, loaded, refresh, ensure, logout }
}
