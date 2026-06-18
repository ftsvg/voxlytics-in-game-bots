import { COLORS } from './constants.js'
import { getAllNicks } from './identityStore.js'
import { loadMessageId, saveMessageId } from './messageIdStore.js'

let listMessageId = loadMessageId()

export async function updateNickList() {
    const entries = getAllNicks()

    let description = '```\n'

    if (entries.length === 0) {
        description += 'No nicked players currently tracked.\n'
    } else {
        const maxLen = Math.max(...entries.map(([p]) => p.length))
        for (const [player, nick] of entries) {
            description += `${player.padEnd(maxLen)} ➡ ${nick}\n`
        }
    }

    description += '```'

    const payload = {
        embeds: [
            {
                title: 'Currently Nicked Players',
                description,
                color: COLORS.LIST
            }
        ]
    }

    try {
        if (listMessageId) {
            const res = await fetch(
                `${process.env.WEBHOOK_URL_2}/messages/${listMessageId}`,
                {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                }
            )

            if (!res.ok) {
                listMessageId = null
                saveMessageId('')
            }
        }

        if (!listMessageId) {
            const res = await fetch(
                `${process.env.WEBHOOK_URL_2}?wait=true`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                }
            )
            const data = await res.json()
            listMessageId = data.id
            saveMessageId(listMessageId)
        }
    } catch (err) {
        console.error('Error updating nick list:', err)
    }
}