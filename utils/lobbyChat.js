import { sendLobbyMessage } from "./sendLobbyMessage.js"
import { reverseMap, identityMap } from "../denicker/identityStore.js"

export async function WatchLobby(bot, lobby) {
    bot.on('messagestr', async (message) => {
        if (![1, 2].includes(lobby)) return

        const channel = lobby === 2 ? 'chat_2' : 'chat_1'

        const msg = message.trim()

        if (msg.includes('store.bedwarspractice.club')) return
        if (msg === 'Click here to join the queue!') return
        if (msg === 'A Block Sumo game is starting in 20 seconds!') return
        if (msg.includes('Support development and server costs > store.bedwarspractice.club')) return
        if (msg.includes('discord.gg')) return
        if (msg.startsWith('Friend >')) return
        if (msg.startsWith('Guild >')) return
        if (msg.startsWith('(!)')) return

        if (msg.includes('has joined!') || msg.includes('has left!')) {
            await sendLobbyMessage({
                content: msg,
                channel
            })
            return
        }

        const denickMatch = msg.match(/^From (?:.+\s)?(\S+):\s*\?denick\s+(\S+)/i)
        if (denickMatch) {
            const sender = denickMatch[1]
            const queried = denickMatch[2]
            const queriedLower = queried.toLowerCase()
            const original = [...reverseMap.entries()].find(([k]) => k.toLowerCase() === queriedLower)?.[1]
            const nick = [...identityMap.entries()].find(([k]) => k.toLowerCase() === queriedLower)?.[1]?.nick
            const reply = original
                ? `${queried}'s original IGN is ${original}`
                : nick
                    ? `${queried} is currently nicked as ${nick}`
                    : `No nick found for ${queried}`
            bot.chat(`/msg ${sender} ${reply}`)
            return
        }

        const match = msg.match(/^\[(.+?)\]\s+(?:\[(.+?)\]\s+)?([^:]+):\s+(.+)$/)
        if (!match) return

        const level = match[1]
        const rank = match[2]
        const player = match[3]

        const content = match[4]
            .replace(/@everyone/gi, 'everyone')
            .replace(/@here/gi, 'here')
            .trim()

        const title = rank
            ? `[${level}] [${rank}] ${player}`
            : `[${level}] ${player}`

        await sendLobbyMessage({
            content,
            title,
            username: player,
            channel
        })
    })
}