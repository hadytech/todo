import { currentUser } from '../../utils/auth'
import { dbConfigured } from '../../utils/db'

/**
 * Who, if anyone, is signed in.
 *
 * Also the one endpoint the client uses to find out whether the write
 * side exists at all — with no database the UI hides the review form
 * instead of offering a button that cannot work.
 */
export default defineEventHandler(async (event) => {
  if (!dbConfigured()) return { user: null, enabled: false }
  return { user: await currentUser(event), enabled: true }
})
