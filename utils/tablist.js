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
      // Use displayName if available (preserves rank tags), fallback to username
      const display = p.displayName?.toString?.() ?? p.username
      return display
    })
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))

  const count = names.length
  const playerList = names.length > 0 ? names.join('\n') : 'No players online.'
  const unixNow = Math.floor(Date.now() / 1000)

  return {
    flags: 32768, // IS_COMPONENTS_V2
    components: [
      {
        type: 17, // Container
        components: [
          {
            type: 10, // Text Display
            content: `## Server Tab List — Lobby ${lobby} (${count} Players)`
          },
          {
            type: 14, // Separator
            divider: true,
            spacing: 1
          },
          {
            type: 10,
            content: `\`\`\`\n${playerList}\n\`\`\``
          },
          {
            type: 14,
            divider: true,
            spacing: 1
          },
          {
            type: 10,
            content: `-# Last updated: <t:${unixNow}:R>`
          }
        ]
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
