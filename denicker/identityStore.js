const identityMap = new Map()
const reverseMap = new Map()

const NICK_TTL = 3 * 60 * 60 * 1000

export function getOriginalIGN(username) {
  return reverseMap.get(username) ?? username
}

export function nickPlayer(original, nick) {
  identityMap.set(original, { nick, lastSeen: Date.now() })
  reverseMap.set(nick, original)
}

export function renickPlayer(original, oldNick, newNick) {
  identityMap.set(original, { nick: newNick, lastSeen: Date.now() })
  reverseMap.delete(oldNick)
  reverseMap.set(newNick, original)
}

export function unnickPlayer(original, nick) {
  identityMap.delete(original)
  reverseMap.delete(nick)
}

export function hasNick(original) {
  return identityMap.has(original)
}

export function touchNick(original) {
  const entry = identityMap.get(original)
  if (entry) entry.lastSeen = Date.now()
}

export function cleanupExpiredNicks() {
  const now = Date.now()
  let cleaned = 0

  for (const [original, { nick, lastSeen }] of identityMap.entries()) {
    if (now - lastSeen > NICK_TTL) {
      identityMap.delete(original)
      reverseMap.delete(nick)
      cleaned++
    }
  }

  return cleaned
}

export function getAllNicks() {
  return Array.from(identityMap.entries()).map(
    ([original, { nick }]) => [original, nick]
  )
}

export { identityMap, reverseMap }