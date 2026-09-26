import { currentUser } from '../../utils/auth'
import { dbConfigured } from '../../utils/db'
import { ensureSchema } from '../../utils/migrate'

/**
 * Who, if anyone, is signed in.
 *
 * Also the one endpoint the client uses to find out whether the write
 * side exists at all — with no database the UI hides the review form
 * instead of offering a button that cannot work.
 */
export default defineEventHandler(async (event) => {
  if (!dbConfigured()) return { user: null, enabled: false }
  await ensureSchema()
  /**
   * `enabled: true` even if reading the session failed.
   *
   * This is the answer the whole interface branches on. A database that is
   * connected but momentarily unhappy should not make the site hide its
   * review form and offer the clipboard instead — that is the degraded
   * path for having no database at all, and showing it here would be a
   * lie that looks like a missing feature.
   */
  return { user: await currentUser(event).catch(() => null), enabled: true }
})
