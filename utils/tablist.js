import fs from 'fs'
import 'dotenv/config'

const REFRESH_INTERVAL = 15 * 1000

// Persistent message IDs per lobby stored in tablist_msg_<lobby>.txt
function loadMsgId(lobby) {
  try {
    const raw = fs.readFileSync(`./tablist_msg_${lobby}.txt`, 'utf8').trim()
    return raw || null
  } catch {
    return null
  }
}

function saveMsgId(lobby, id) {
  try {
    fs.writeFileSync(`./tablist_msg_${lobby}.txt`, id)
  } catch {}
}

function buildPayload(players, lobby) {
  const names = Object.values(players)
    .filter(p => !p.username.includes('npc-'))
    .map(p => {
      const full = p.displayName?.toString?.() ?? p.username
      // Guild tag is the last [...] at the end, e.g. "[Master] Ventros [Shine]"
      const guildMatch = full.match(/^(.*)\s+(\[[^\]]+\])$/)
      const namePart = guildMatch ? guildMatch[1] : full
      const guildPart = guildMatch ? guildMatch[2] : ''
      const ping = p.ping != null ? `${p.ping}ms` : ''
      const codePart = [guildPart, ping].filter(Boolean).join(' ')
      const suffix = codePart ? ` \`${codePart}\`` : ''
      return { line: `**${namePart}**${suffix}`, username: p.username }
    })
    .sort((a, b) => a.username.localeCompare(b.username, undefined, { sensitivity: 'base' }))
    .map(p => p.line)

  const count = names.length
  const playerList = names.length > 0
    ? names.map(n => `> ${n}`).join('\n')
    : '> No players online.'
  const unixNow = Math.floor(Date.now() / 1000)

  return {
    embeds: [
      {
        title: `Server Tab List — Lobby ${lobby} (${count} Players)`,
        description: playerList,
        footer: { text: `Last updated` },
        timestamp: new Date().toISOString(),
        color: 0x5865F2
      }
    ]
  }
}

export function startTablist(bot, lobby) {
  const webhookUrl = process.env[`WEBHOOK_TABLIST_${lobby}`]
  if (!webhookUrl) {
    console.warn(`[tablist] No WEBHOOK_TABLIST_${lobby} set, skipping.`)
    return
  }

  let msgId = loadMsgId(lobby)

  async function refresh() {
    const payload = buildPayload(bot.players, lobby)

    try {
      if (msgId) {
        const res = await fetch(`${webhookUrl}/messages/${msgId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })

        if (!res.ok) {
          // Message was deleted or inaccessible — post fresh
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
          console.log(`[tablist] lobby ${lobby} posted message ${msgId}`)
        } else {
          console.error(`[tablist] lobby ${lobby} POST failed ${res.status}:`, text)
        }
      }
    } catch (err) {
      console.error(`[tablist] lobby ${lobby} refresh error:`, err)
    }
  }

  // Wait for the bot to be settled in the lobby before first send
  console.log(`[tablist] lobby ${lobby} scheduled, webhook set`)
  setTimeout(() => {
    console.log(`[tablist] lobby ${lobby} firing first refresh`)
    refresh()
    setInterval(refresh, REFRESH_INTERVAL)
  }, 12000)
}
