const suppressed = new Set()

export function suppressUsername(username, durationMs = 15000) {
  suppressed.add(username)
  setTimeout(() => suppressed.delete(username), durationMs)
}

export function isSuppressed(username) {
  return suppressed.has(username)
}
