import { cleanupExpiredNicks } from './identityStore.js'
import { updateNickList } from './nickList.js'

export async function startNickExpiry() {
  // Sync the Discord message on startup to reflect actual (empty) state
  await updateNickList()

  setInterval(async () => {
    const cleaned = cleanupExpiredNicks()
    if (cleaned > 0) await updateNickList()
  }, 60 * 1000)
}
