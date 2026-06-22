import { sendLobbyMessage } from "./sendLobbyMessage.js"
import { getOriginalIGN, reverseMap } from "../denicker/identityStore.js"

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

        const denickMatch = msg.match(/^From (\S+): \?denick\s+(\S+)$/i)
        if (denickMatch) {
            const queried = denickMatch[2]
            const original = reverseMap.get(queried)
            const reply = original
                ? `${original} is nicked as ${queried}`
                : `No nick found for ${queried}`
            bot.chat(`/msg ${denickMatch[1]} ${reply}`)
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