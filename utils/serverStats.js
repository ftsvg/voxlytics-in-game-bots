import fs from 'fs'
import 'dotenv/config'

const REFRESH_INTERVAL = 15 * 1000

function loadMsgId(lobby) {
  try {
    const raw = fs.readFileSync(`./stats_msg.txt`, 'utf8').trim()
    return raw || null
  } catch {
    return null
  }
}

function saveMsgId(lobby, id) {
  try {
    fs.writeFileSync(`./stats_msg.txt`, id)
  } catch {}
}

function readScoreboard(bot) {
  try {
    const sidebar = Object.values(bot.scoreboard).find(s => s.position === 1)
    if (!sidebar) return null

    const items = Object.values(sidebar.items ?? {})
      .sort((a, b) => b.value - a.value)
      .map(i => i.displayName?.toString?.() ?? i.name ?? '')

    // Log raw items once so we can verify the format
    console.log('[serverstats] scoreboard items:', items)

    // Parse "All: 72" and "Playing: 47" style lines
    let all = null
    let playing = null

    for (const line of items) {
      const allMatch = line.match(/All[:\s]+(\d+)/i)
      const playMatch = line.match(/Playing[:\s]+(\d+)/i)
      if (allMatch) all = parseInt(allMatch[1])
      if (playMatch) playing = parseInt(playMatch[1])
    }

    return { all, playing }
  } catch (err) {
    console.error('[serverstats] scoreboard read error:', err)
    return null
  }
}

function buildPayload(bot, lobby) {
  const stats = readScoreboard(bot)
  const unixNow = Math.floor(Date.now() / 1000)

  const fields = stats
    ? [
        { name: 'Online (All)', value: stats.all != null ? `**${stats.all}**` : 'N/A', inline: true },
        { name: 'Playing', value: stats.playing != null ? `**${stats.playing}**` : 'N/A', inline: true },
      ]
    : [{ name: 'Status', value: 'Scoreboard unavailable', inline: false }]

  return {
    embeds: [
      {
        title: `Server Stats`,
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
    console.warn(`[serverstats] No WEBHOOK_STATS set, skipping.`)
    return
  }

  let msgId = loadMsgId(lobby)

  async function refresh() {
    const payload = buildPayload(bot, lobby)

    try {
      if (msgId) {
        const res = await fetch(`${webhookUrl}/messages/${msgId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
        if (!res.ok) {
          msgId = null
          saveMsgId(lobby, '')
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
          saveMsgId(lobby, msgId)
          console.log(`[serverstats] posted message ${msgId}`)
        } else {
          console.error(`[serverstats] POST failed ${res.status}:`, text)
        }
      }
    } catch (err) {
      console.error(`[serverstats] lobby ${lobby} refresh error:`, err)
    }
  }

  setTimeout(() => {
    console.log(`[serverstats] firing first refresh`)
    refresh()
    setInterval(refresh, REFRESH_INTERVAL)
  }, 14000)
}
