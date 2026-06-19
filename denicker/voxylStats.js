const statsCache = new Map()

export async function isFakeNick(uuid) {
  if (statsCache.has(uuid)) {
    const cached = statsCache.get(uuid)
    if (Date.now() - cached.time < 300000) {
      return cached.fake
    }
  }

  try {
    const res = await fetch(
      `https://api.voxyl.net/player/stats/overall/${uuid}?api=${process.env.API_KEY}`
    )

    if (!res.ok) {
      if (res.status === 404) {
        statsCache.set(uuid, { fake: true, time: Date.now() })
        return true
      }
      return false
    }

    const data = await res.json()

    if (!data || Object.keys(data).length === 0) {
      statsCache.set(uuid, { fake: true, time: Date.now() })
      return true
    }

    statsCache.set(uuid, { fake: false, time: Date.now() })
    return false
  } catch {
    return false
  }
}
