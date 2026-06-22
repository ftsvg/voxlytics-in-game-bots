import { sendWebhook } from './sendWebhook.js'
import { COLORS, MIN_NICK_DELAY, MAX_NICK_DELAY, PING_SAMPLE_COUNT, PING_SAMPLE_INTERVAL, PING_TOLERANCE } from './constants.js'
import { suppressUsername } from './nickSuppression.js'
import {
  getOriginalIGN,
  nickPlayer,
  renickPlayer,
  unnickPlayer,
  hasNick,
  touchNick
} from './identityStore.js'
import {
  cleanOldEvents,
  findMatchingEvent,
  pushEvent,
  lockEvent,
  unlockEvent,
  markMatched
} from './eventQueue.js'
import { getPlayerRole, canNick } from './roles.js'
import { updateNickList } from './nickList.js'

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function sampleAvgPing(bot, username) {
  const samples = []
  for (let i = 0; i < PING_SAMPLE_COUNT; i++) {
    await sleep(PING_SAMPLE_INTERVAL)
    const ping = bot.players[username]?.ping
    if (ping != null) samples.push(ping)
  }
  if (samples.length === 0) return null
  return Math.round(samples.reduce((a, b) => a + b, 0) / samples.length)
}

function pingField(leavePing, joinPing) {
  if (leavePing == null || joinPing == null) return []
  return [{ name: 'Ping', value: `\`${leavePing}ms → ${joinPing}ms\``, inline: true }]
}

async function handlePair(bot, lobby, left, joined, leavePing) {
  const originalIGN = getOriginalIGN(left)
  const role = await getPlayerRole(originalIGN)

  if (!canNick(role)) return

  const joinPing = await sampleAvgPing(bot, joined)

  if (leavePing != null && joinPing != null && Math.abs(leavePing - joinPing) > PING_TOLERANCE) {
    console.log(`[denicker] ping mismatch: ${left}=${leavePing}ms avg vs ${joined}=${joinPing}ms avg — skipping`)
    return
  }

  if (joined === originalIGN) {
    if (hasNick(originalIGN)) {
      unnickPlayer(originalIGN, left)
      sendWebhook('Unnick', 'A new unnick has been detected.', COLORS.UNNICK, [
        { name: 'Nick', value: `\`${left}\``, inline: true },
        { name: 'Player', value: `\`${originalIGN}\``, inline: true },
        ...pingField(leavePing, joinPing)
      ])
    }
    touchNick(originalIGN)
    await updateNickList()
    return
  }

  if (hasNick(originalIGN)) {
    renickPlayer(originalIGN, left, joined)
    sendWebhook('Renick', 'A new renick has been detected.', COLORS.RENICK, [
      { name: 'Player', value: `\`${originalIGN}\``, inline: true },
      { name: 'Old Nick', value: `\`${left}\``, inline: true },
      { name: 'New Nick', value: `\`${joined}\``, inline: true },
      ...pingField(leavePing, joinPing)
    ])
  } else {
    nickPlayer(originalIGN, joined)
    sendWebhook('Nick', 'A new nick has been detected.', COLORS.NICK, [
      { name: 'Player', value: `\`${originalIGN}\``, inline: true },
      { name: 'Nick', value: `\`${joined}\``, inline: true },
      ...pingField(leavePing, joinPing)
    ])
  }

  touchNick(originalIGN)
  await updateNickList()
}

export async function checkNicks(bot) {
  const lobby = bot.lobby

  bot.on('playerJoined', async (player) => {
    if (player.username.includes('npc-')) return

    const joined = player.username
    const now = Date.now()

    cleanOldEvents(lobby, now)
    const match = findMatchingEvent(lobby, 'leave', now, MIN_NICK_DELAY, MAX_NICK_DELAY)

    if (!match) {
      pushEvent(lobby, 'join', joined, now)
      return
    }

    const { event, index } = match
    const left = event.username
    const leavePing = event.ping

    lockEvent(lobby, index)

    const originalIGN = getOriginalIGN(left)
    const role = await getPlayerRole(originalIGN)

    if (role === null) {
      unlockEvent(lobby, index)
      return
    }

    markMatched(lobby, index)

    if (!canNick(role)) return

    suppressUsername(left)
    suppressUsername(joined)
    await handlePair(bot, lobby, left, joined, leavePing)
  })

  bot.on('playerLeft', async (player) => {
    if (player.username.includes('npc-')) return

    const left = player.username
    const leavePing = bot.players[left]?.ping ?? null
    const now = Date.now()

    cleanOldEvents(lobby, now)
    const match = findMatchingEvent(lobby, 'join', now, MIN_NICK_DELAY, MAX_NICK_DELAY)

    if (!match) {
      pushEvent(lobby, 'leave', left, now, leavePing)
      return
    }

    const { event, index } = match
    const joined = event.username

    lockEvent(lobby, index)

    const originalIGN = getOriginalIGN(left)
    const role = await getPlayerRole(originalIGN)

    if (role === null) {
      unlockEvent(lobby, index)
      return
    }

    markMatched(lobby, index)

    if (!canNick(role)) return

    suppressUsername(left)
    suppressUsername(joined)
    await handlePair(bot, lobby, left, joined, leavePing)
  })
}
