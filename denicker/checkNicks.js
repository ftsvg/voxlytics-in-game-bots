import { sendWebhook } from './sendWebhook.js'
import { COLORS, MIN_NICK_DELAY, MAX_NICK_DELAY, PING_CHECK_DELAY, PING_TOLERANCE } from './constants.js'
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

async function getPing(bot, username) {
  await sleep(PING_CHECK_DELAY)
  return bot.players[username]?.ping ?? null
}

const ms = ping => ping != null ? `${ping}ms` : '?ms'

async function handlePair(bot, lobby, left, joined, leavePing) {
  const originalIGN = getOriginalIGN(left)
  const role = await getPlayerRole(originalIGN)

  if (!canNick(role)) return

  const isRenick = hasNick(originalIGN)

  const joinPing = await getPing(bot, joined)

  if (leavePing != null && joinPing != null && Math.abs(leavePing - joinPing) > PING_TOLERANCE) {
    console.log(`[denicker] ping mismatch: ${left}=${leavePing}ms vs ${joined}=${joinPing}ms — skipping`)
    return
  }

  if (joined === originalIGN) {
    if (hasNick(originalIGN)) {
      unnickPlayer(originalIGN, left)
      sendWebhook('Unnick', 'A new unnick has been detected.', COLORS.UNNICK, [
        { name: 'Nick', value: `\`${left} (${ms(leavePing)})\``, inline: true },
        { name: 'Player', value: `\`${originalIGN} (${ms(joinPing)})\``, inline: true },
      ])
    }
    touchNick(originalIGN)
    await updateNickList()
    return
  }

  if (isRenick) {
    renickPlayer(originalIGN, left, joined)
    sendWebhook('Renick', 'A new renick has been detected.', COLORS.RENICK, [
      { name: 'Player', value: `\`${originalIGN}\``, inline: true },
      { name: 'Old Nick', value: `\`${left} (${ms(leavePing)})\``, inline: true },
      { name: 'New Nick', value: `\`${joined} (${ms(joinPing)})\``, inline: true },
    ])
  } else {
    nickPlayer(originalIGN, joined)
    sendWebhook('Nick', 'A new nick has been detected.', COLORS.NICK, [
      { name: 'Player', value: `\`${originalIGN} (${ms(leavePing)})\``, inline: true },
      { name: 'Nick', value: `\`${joined} (${ms(joinPing)})\``, inline: true },
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
    const leavePing = player.ping ?? null
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
