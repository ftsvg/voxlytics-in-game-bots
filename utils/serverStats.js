import fs from 'fs'
import 'dotenv/config'

const REFRESH_INTERVAL = 15 * 1000

// Scores captured from raw packets: { [itemName]: score }
const scores = new Map()

function loadMsgId() {
  try {
    const raw = fs.readFileSync('./stats_msg.txt', 'utf8').trim()
    return raw || null
  } catch {
    return null
  }
}

function saveMsgId(id) {
  try {
    fs.writeFileSync('./stats_msg.txt', id)
  } catch {}
}

function getStats() {
  let all = null
  let playing = null

  for (const [name, score] of scores) {
    if (/^All/.test(name)) all = score
    else if (/^Playing/.test(name)) playing = score
  }

  return { all, playing }
}

function buildPayload() {
  const { all, playing } = getStats()

  const fields = (all != null || playing != null)
    ? [
        { name: 'Online (All)', value: all != null ? `**${all}**` : 'N/A', inline: true },
        { name: 'Playing', value: playing != null ? `**${playing}**` : 'N/A', inline: true },
      ]
    : [{ name: 'Status', value: 'Scoreboard unavailable', inline: false }]

  return {
    embeds: [
      {
        title: 'Server Stats',
        fields,
        footer: { text: 'Last updated' },
        timestamp: new Date().toISOString(),
        color: 0x57F287
      }
    ]
  }
}

export function startServerStats(bot, lobby) {
  if (lobby !== 1) return

  const webhookUrl = process.env.WEBHOOK_STATS
  if (!webhookUrl) {
    console.warn('[serverstats] No WEBHOOK_STATS set, skipping.')
    return
  }

  // Log all packets once to find the scoreboard score packet name
  const _seen = new Set()
  bot._client.on('packet', (data, meta) => {
    if (!_seen.has(meta.name) && JSON.stringify(data).toLowerCase().includes('playing')) {
      console.log(`[serverstats] packet with "playing": ${meta.name}`, JSON.stringify(data).slice(0, 300))
      _seen.add(meta.name)
    }
  })

  // Capture score updates from raw packets
  bot._client.on('update_score', (packet) => {
    const name = packet.itemName ?? packet.scoreName ?? ''
    const score = packet.value ?? packet.score ?? null
    if (score != null) scores.set(name, score)
  })

  bot._client.on('scoreboard_score', (packet) => {
    const name = packet.itemName ?? ''
    const score = packet.value ?? null
    if (score != null) scores.set(name, score)
  })

  let msgId = loadMsgId()

  async function refresh() {
    const payload = buildPayload()

    try {
      if (msgId) {
        const res = await fetch(`${webhookUrl}/messages/${msgId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
        if (!res.ok) {
          msgId = null
          saveMsgId('')
        }
      }

      if (!msgId) {
        const res = await fetch(`${webhookUrl}?wait=true`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
        const text = await res.text()
        if (res.ok) {
          const data = JSON.parse(text)
          msgId = data.id
          saveMsgId(msgId)
          console.log(`[serverstats] posted message ${msgId}`)
        } else {
          console.error(`[serverstats] POST failed ${res.status}:`, text)
        }
      }
    } catch (err) {
      console.error(`[serverstats] refresh error:`, err)
    }
  }

  setTimeout(() => {
    console.log('[serverstats] firing first refresh, scores:', Object.fromEntries(scores))
    refresh()
    setInterval(refresh, REFRESH_INTERVAL)
  }, 14000)
}
