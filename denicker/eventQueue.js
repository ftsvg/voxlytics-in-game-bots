import { EVENT_HISTORY_TIME } from './constants.js'

const lobbyEvents = new Map()
const lockedKeys = new Set()

function getEvents(lobby) {
    if (!lobbyEvents.has(lobby)) lobbyEvents.set(lobby, [])
    return lobbyEvents.get(lobby)
}

export function cleanOldEvents(lobby, now) {
    const events = getEvents(lobby)
    while (events.length > 0 && now - events[0].time > EVENT_HISTORY_TIME) {
        events.shift()
    }
}

export function findMatchingEvent(lobby, type, now, minDelay, maxDelay) {
    const events = getEvents(lobby)
    for (let i = events.length - 1; i >= 0; i--) {
        const event = events[i]
        const key = `${lobby}:${i}`
        if (event.type === type && !event.matched && !lockedKeys.has(key)) {
            const delta = Math.abs(now - event.time)
            if (delta >= minDelay && delta <= maxDelay) {
                return { event, index: i }
            }
        }
    }
    return null
}

export function lockEvent(lobby, index) {
    lockedKeys.add(`${lobby}:${index}`)
}

export function unlockEvent(lobby, index) {
    lockedKeys.delete(`${lobby}:${index}`)
}

export function markMatched(lobby, index) {
    const events = getEvents(lobby)
    if (!events[index]) return
    events[index].matched = true
    lockedKeys.delete(`${lobby}:${index}`)
}

export function pushEvent(lobby, type, username, time) {
    getEvents(lobby).push({ type, username, time, matched: false })
}
