import { NICK_ALLOWED_ROLES } from './constants.js'
import { isFakeNick } from './voxylStats.js'

const roleCache = new Map()

export async function getPlayerRole(username) {
  if (roleCache.has(username)) {
    const cached = roleCache.get(username)
    if (Date.now() - cached.time < 300000) {
      return cached.role
    }
  }

  try {
    const response = await fetch(
      `https://playerdb.co/api/player/minecraft/${username}`
    )
    const data = await response.json()

    if (!data.success || !data.data?.player?.id) return null

    const uuid = data.data.player.id

    const fake = await isFakeNick(uuid)
    if (fake) return null

    const voxylResponse = await fetch(
      `https://api.voxyl.net/player/info/${uuid}?api=${process.env.API_KEY}`
    )
    const voxylData = await voxylResponse.json()

    const role = voxylData.role || null
    roleCache.set(username, { role, time: Date.now() })

    return role
  } catch {
    return null
  }
}

export function canNick(role) {
  return role && NICK_ALLOWED_ROLES.includes(role)
}