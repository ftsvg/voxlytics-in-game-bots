import { sendWebhook } from './sendWebhook.js'
import { COLORS, MIN_NICK_DELAY, MAX_NICK_DELAY } from './constants.js'
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

async function handlePair(bot, left, joined) {
  const originalIGN = getOriginalIGN(left)
  const role = await getPlayerRole(originalIGN)

  if (!canNick(role)) return

  const isRenick = hasNick(originalIGN)
  const isUnnick = joined === originalIGN

  // Update identity immediately so subsequent events resolve correctly
  // during the async getPing call below.
  if (isUnnick) {
    if (hasNick(originalIGN)) unnickPlayer(originalIGN, left)
  } else if (isRenick) {
    renickPlayer(originalIGN, left, joined)
  } else {
    nickPlayer(originalIGN, joined)
  }

  touchNick(originalIGN)
  await updateNickList()

  if (isUnnick) {
    sendWebhook('Unnick', 'A new unnick has been detected.', COLORS.UNNICK, [
      { name: 'Nick', value: `\`${left}\``, inline: true },
      { name: 'Player', value: `\`${originalIGN}\``, inline: true },
    ])
  } else if (isRenick) {
    sendWebhook('Renick', 'A new renick has been detected.', COLORS.RENICK, [
      { name: 'Player', value: `\`${originalIGN}\``, inline: true },
      { name: 'Old Nick', value: `\`${left}\``, inline: true },
      { name: 'New Nick', value: `\`${joined}\``, inline: true },
    ])
  } else {
    sendWebhook('Nick', 'A new nick has been detected.', COLORS.NICK, [
      { name: 'Player', value: `\`${originalIGN}\``, inline: true },
      { name: 'Nick', value: `\`${joined}\``, inline: true },
    ])
  }
}

async function processMatch(bot, event, left, joined) {
  lockEvent(event)

  const originalIGN = getOriginalIGN(left)
  const role = await getPlayerRole(originalIGN)

  if (role === null) {
    unlockEvent(event)
    return
  }

  markMatched(event)

  if (!canNick(role)) return

  suppressUsername(left)
  suppressUsername(joined)
  await handlePair(bot, left, joined)
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
      console.log(`[denicker] join no-match: ${joined} at ${now}`)
      pushEvent(lobby, 'join', joined, now)
      return
    }

    const { event } = match
    const left = event.username
    console.log(`[denicker] join-side match: ${left} -> ${joined}, delta=${now - event.time}ms`)

    await processMatch(bot, event, left, joined)
  })

  bot.on('playerLeft', async (player) => {
    if (player.username.includes('npc-')) return

    const left = player.username
    const now = Date.now()

    cleanOldEvents(lobby, now)
    const match = findMatchingEvent(lobby, 'join', now, MIN_NICK_DELAY, MAX_NICK_DELAY)

    if (!match) {
      console.log(`[denicker] leave no-match: ${left} at ${now}`)
      pushEvent(lobby, 'leave', left, now)
      return
    }

    const { event } = match
    const joined = event.username
    console.log(`[denicker] leave-side match: ${left} -> ${joined}, delta=${now - event.time}ms`)

    await processMatch(bot, event, left, joined)
  })
}
