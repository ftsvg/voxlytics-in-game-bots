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

async function handlePair(lobby, left, joined) {
  const originalIGN = getOriginalIGN(left)
  const role = await getPlayerRole(originalIGN)

  if (!canNick(role)) return

  if (joined === originalIGN) {
    if (hasNick(originalIGN)) {
      unnickPlayer(originalIGN, left)
      sendWebhook('Unnick', 'A new unnick has been detected.', COLORS.UNNICK, [
        { name: 'Nick', value: `\`${left}\``, inline: true },
        { name: 'Player', value: `\`${originalIGN}\``, inline: true }
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
      { name: 'New Nick', value: `\`${joined}\``, inline: true }
    ])
  } else {
    nickPlayer(originalIGN, joined)
    sendWebhook('Nick', 'A new nick has been detected.', COLORS.NICK, [
      { name: 'Player', value: `\`${originalIGN}\``, inline: true },
      { name: 'Nick', value: `\`${joined}\``, inline: true }
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
    await handlePair(lobby, left, joined)
  })

  bot.on('playerLeft', async (player) => {
    if (player.username.includes('npc-')) return

    const left = player.username
    const now = Date.now()

    cleanOldEvents(lobby, now)
    const match = findMatchingEvent(lobby, 'join', now, MIN_NICK_DELAY, MAX_NICK_DELAY)

    if (!match) {
      pushEvent(lobby, 'leave', left, now)
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
    await handlePair(lobby, left, joined)
  })
}
