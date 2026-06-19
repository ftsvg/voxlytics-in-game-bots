import axios from 'axios'
import 'dotenv/config'

const webhookUrl = process.env.WEBHOOK_TRACKER

const MODE_NAMES = {
  // Solo Duels
  bridges5ingle: 'Bed Bridge Fight 1v1',
  obstacleSingle: 'Obstacles',
  resourceOldSingle: 'Resource Collect Old 1v1',
  voidSingle: 'Void Fight 1v1',
  bedwarsLateSingle: 'Bedwars Lategame 1v1',
  stickFightSingle: 'Stick Fight 1v1',
  ladderFightSingle: 'Ladder Fight 1v1',
  pearFightSingle: 'Pearl Fight 1v1',
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

const statsCache = new Map()

let apiQueue = Promise.resolve()
const API_DELAY = 600

function enqueue(fn) {
  const result = apiQueue.then(fn)
  apiQueue = result.catch(() => {}).then(() => new Promise(r => setTimeout(r, API_DELAY)))
  return result
}

async function fetchPlayerData(uuid) {
  if (statsCache.has(uuid)) {
    const cached = statsCache.get(uuid)
    if (Date.now() - cached.time < 300000) return cached.data
  }

  return enqueue(async () => {
    if (statsCache.has(uuid)) {
      const cached = statsCache.get(uuid)
      if (Date.now() - cached.time < 300000) return cached.data
    }

    try {
      const [overallRes, gameRes] = await Promise.all([
        fetch(`https://api.voxyl.net/player/stats/overall/${uuid}?api=${process.env.API_KEY}`),
        fetch(`https://api.voxyl.net/player/stats/game/${uuid}?api=${process.env.API_KEY}`)
      ])

      if (!overallRes.ok || !gameRes.ok) return null

      const overall = await overallRes.json()
      const game = await gameRes.json()

      const data = { overall, game }
      statsCache.set(uuid, { data, time: Date.now() })
      return data
    } catch {
      return null
    }
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

async function sendTrackerMessage(username, uuid, lobby, action) {
  if (!webhookUrl) return

  const data = await fetchPlayerData(uuid)

  const level = data?.overall?.level ?? 0
  const star = level >= 1100 ? '✪' : '✫'
  const levelStr = `[${level}${star}]`

  const mostPlayed = getMostPlayedMode(data?.game)
  const mostPlayedStr = mostPlayed
    ? `\`${MODE_NAMES[mostPlayed.key] ?? mostPlayed.key} | ${mostPlayed.wins.toLocaleString()} Wins\``
    : '`Unknown`'

  const weightedWins = data?.overall?.weightedwins ?? null
  const winsStr = weightedWins !== null
    ? `**Overall Wins:** \`${parseInt(weightedWins).toLocaleString()}\``
    : ''

  let msg
  if (action === 'join') {
    msg = `\`${levelStr} ${username}\` has been spotted in **Lobby ${lobby}!** Most played mode ${mostPlayedStr} ${winsStr}`.trim()
  } else {
    msg = `\`${levelStr} ${username}\` has left Lobby ${lobby}! Most played mode ${mostPlayedStr} ${winsStr}`.trim()
  }

  try {
    await axios.post(webhookUrl, { content: msg })
  } catch {}
}

export function startLobbyTracker(bot, lobby) {
  bot.on('playerJoined', async (player) => {
    if (player.username.includes('npc-')) return
    await sendTrackerMessage(player.username, player.uuid, lobby, 'join')
  })

  bot.on('playerLeft', async (player) => {
    if (player.username.includes('npc-')) return
    await sendTrackerMessage(player.username, player.uuid, lobby, 'leave')
  })
}
