import { EVENT_HISTORY_TIME } from './constants.js'

const lobbyEvents = new Map()
const lockedIds = new Set()
let nextId = 0

function getEvents(lobby) {
    if (!lobbyEvents.has(lobby)) lobbyEvents.set(lobby, [])
    return lobbyEvents.get(lobby)
}

export function cleanOldEvents(lobby, now) {
    const events = getEvents(lobby)
    while (events.length > 0 && now - events[0].time > EVENT_HISTORY_TIME) {
        lockedIds.delete(events[0].id)
        events.shift()
    }
}

export function findMatchingEvent(lobby, type, now, minDelay, maxDelay) {
    const events = getEvents(lobby)
    for (let i = events.length - 1; i >= 0; i--) {
        const event = events[i]
        if (event.type === type && !event.matched && !lockedIds.has(event.id)) {
            const delta = Math.abs(now - event.time)
            if (delta >= minDelay && delta <= maxDelay) {
                return { event }
            }
        }
    }
    return null
}

export function lockEvent(event) {
    lockedIds.add(event.id)
}

export function unlockEvent(event) {
    lockedIds.delete(event.id)
}

export function markMatched(event) {
    event.matched = true
    lockedIds.delete(event.id)
}

export function pushEvent(lobby, type, username, time, ping = null) {
    getEvents(lobby).push({ id: nextId++, type, username, time, ping, matched: false })
}
