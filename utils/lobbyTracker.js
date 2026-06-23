import axios from 'axios'
import 'dotenv/config'
import { reverseMap } from '../denicker/identityStore.js'
import { NICK_ALLOWED_ROLES } from '../denicker/constants.js'
import { isSuppressed } from '../denicker/nickSuppression.js'

const webhookUrl = process.env.WEBHOOK_TRACKER

const MODE_NAMES = {
  // Solo Duels
  bridgesSingle: 'Bed Bridge Fight 1v1',
  obstacleSingle: 'Obstacles',
  resourceOldSingle: 'Resource Collect Old 1v1',
  voidSingle: 'Void Fight 1v1',
  bedwarsLateSingle: 'Bedwars Lategame 1v1',
  stickFightSingle: 'Stick Fight 1v1',
  ladderFightSingle: 'Ladder Fight 1v1',
  pearlFightSingle: 'Pearl Fight 1v1',
  sumoDuelsSolo: 'Block Sumo',
  resourceSingle: 'Resource Collect 1v1',
  groundSingle: 'Ground Fight 1v1',
  bedwarsNormalSingle: 'Bedwars 1v1',
  bedwarsRushSolo: 'Bedwars Rush 1v1',
  flatFightSingle: 'Flat Fight 1v1',
  bowFightSingle: 'Bow Fight 1v1',
  bedRushSingle: 'Bed Rush 1v1',
  // Double Duels
  bridgesDouble: 'Bed Bridge Fight 2v2',
  resourceDouble: 'Resource Collect 2v2',
  groundDouble: 'Ground Fight 2v2',
  bedwarsNormalDouble: 'Bedwars 2v2',
  bedwarsRushDouble: 'Bedwars Rush 2v2',
  flatFightDouble: 'Flat Fight 2v2',
  sumoDuelsDouble: 'Block Sumo 2v2',
  resourceOldDouble: 'Resource Collect Old 2v2',
  voidDouble: 'Void Fight 2v2',
  bedwarsLateDouble: 'Bedwars Lategame 2v2',
  stickFightDouble: 'Stick Fight 2v2',
  ladderFightDouble: 'Ladder Fight 2v2',
  bowFightDouble: 'Bow Fight 2v2',
  pearlFightDouble: 'Pearl Fight 2v2',
  // Team
  sumo: 'Block Sumo',
  betaSumo: 'Beta Sumo',
  bedwarsMegaSolo: 'Bedwars Mega Solo',
  bedwarsMegaDouble: 'Bedwars Mega Doubles',
  partyGames: 'Party Games',
  rankedFoursPractice: 'Ranked Fours Practice',
  bedwalls: 'Bedwalls',
  bedwarsEightSolo: 'Bedwars 8-Solo',
  bedwarsFoursFours: 'Bedwars FoursFours',
  miniwarsSolo: 'Miniwars Solo',
  miniwarsDouble: 'Miniwars Doubles',
  fourWayBridgeSingle: 'Four Way Bridge Fight',
  wallFightSolo: 'Wall Fight Solo',
  clutchMastersSolo: 'Clutch Masters Solo',
}

// Cache successful results for 5 minutes, failed for 2 minutes
const statsCache = new Map()
const CACHE_TTL = 5 * 60 * 1000
const FAIL_TTL = 2 * 60 * 1000

// Serial queue with gap between requests to avoid bursting the API
let apiQueue = Promise.resolve()

function enqueue(fn) {
  const result = apiQueue.then(fn)
  apiQueue = result.catch(() => {})
  return result
}

async function fetchWithRetry(url, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url)
      if (res.status === 429) {
        const wait = 1000 * 2 ** attempt
        await new Promise(r => setTimeout(r, wait))
        continue
      }
      if (!res.ok) return null
      return await res.json()
    } catch {
      if (attempt === retries - 1) return null
      await new Promise(r => setTimeout(r, 1000 * 2 ** attempt))
    }
  }
  return null
}

async function fetchPlayerData(uuid) {
  const cached = statsCache.get(uuid)
  if (cached) {
    const ttl = cached.data ? CACHE_TTL : FAIL_TTL
    if (Date.now() - cached.time < ttl) return cached.data
  }

  return enqueue(async () => {
    // Re-check after waiting in queue
    const cached = statsCache.get(uuid)
    if (cached) {
      const ttl = cached.data ? CACHE_TTL : FAIL_TTL
      if (Date.now() - cached.time < ttl) return cached.data
    }

    const key = process.env.API_KEY
    const [overall, game] = await Promise.all([
      fetchWithRetry(`https://api.voxyl.net/player/stats/overall/${uuid}?api=${key}`),
      fetchWithRetry(`https://api.voxyl.net/player/stats/game/${uuid}?api=${key}`)
    ])

    const data = overall && game ? { overall, game } : null
    statsCache.set(uuid, { data, time: Date.now() })
    return data
  })
}

function getMostPlayedMode(gameStats) {
  if (!gameStats || !gameStats.stats) return null

  let topMode = null
  let topWins = -1

  for (const [key, val] of Object.entries(gameStats.stats)) {
    const wins = parseInt(val.wins ?? 0)
    if (wins > topWins) {
      topWins = wins
      topMode = key
    }
  }

  if (!topMode || topWins < 0) return null
  return { key: topMode, wins: topWins }
}

function parseRole(displayName) {
  const text = displayName?.toString() ?? ''
  const matches = [...text.matchAll(/\[([^\]]+)\]/g)].map(m => m[1])
  return matches.find(m => NICK_ALLOWED_ROLES.includes(m)) ?? null
}

async function sendTrackerMessage(username, uuid, lobby, action, displayName) {
  if (!webhookUrl) return

  const data = await fetchPlayerData(uuid)

  if (!data) return

  const level = data.overall?.level ?? 0
  const weightedWins = parseInt(data.overall?.weightedwins ?? 0)

  if (level < 75 && weightedWins < 2000) return

  const star = level >= 1100 ? '✪' : '✫'
  const role = parseRole(displayName)
  const roleStr = role ? ` [${role}]` : ''

  const originalIGN = reverseMap.get(username)
  const displayedName = originalIGN ?? username
  const nickSuffix = originalIGN ? ` (nicked as ${username})` : ''

  const tag = `[${level}${star}]${roleStr} ${displayedName}${nickSuffix}`

  const mostPlayed = getMostPlayedMode(data?.game)
  const modeName = mostPlayed ? (MODE_NAMES[mostPlayed.key] ?? mostPlayed.key) : null
  const mostPlayedStr = modeName
    ? `**${modeName} (${mostPlayed.wins.toLocaleString()} Wins)**`
    : '**Unknown**'

  let msg
  if (action === 'join') {
    msg = `🟢 \`${tag}\` has been spotted in **Lobby ${lobby}**!\n> Most played mode: ${mostPlayedStr}\n>  Weighted Wins: **${weightedWins.toLocaleString()}**`
  } else {
    msg = `🔴 \`${tag}\` has left **Lobby ${lobby}**!\n> Most played mode: ${mostPlayedStr}\n> Weighted Wins: **${weightedWins.toLocaleString()}**`
  }

  try {
    await axios.post(webhookUrl, { content: msg })
  } catch {}
}

export function startLobbyTracker(bot, lobby) {
  let ready = false

  setTimeout(() => {
    for (const player of Object.values(bot.players)) {
      if (player.uuid && !player.username.includes('npc-')) {
        fetchPlayerData(player.uuid).catch(() => {})
      }
    }
    ready = true
  }, 10000)

  bot.on('playerJoined', async (player) => {
    if (player.username.includes('npc-')) return
    if (!ready) {
      fetchPlayerData(player.uuid).catch(() => {})
      return
    }
    if (isSuppressed(player.username)) return
    await sendTrackerMessage(player.username, player.uuid, lobby, 'join', player.displayName)
  })

  bot.on('playerLeft', async (player) => {
    if (!ready) return
    if (player.username.includes('npc-')) return
    if (isSuppressed(player.username)) return
    await sendTrackerMessage(player.username, player.uuid, lobby, 'leave', player.displayName)
  })
}
