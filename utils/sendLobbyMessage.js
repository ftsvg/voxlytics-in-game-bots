import axios from 'axios'
import 'dotenv/config'

const webhooks = {
    chat_1: process.env.WEBHOOK_URL_CHAT,
    chat_2: process.env.WEBHOOK_URL_CHAT_2
}

export async function sendLobbyMessage({
    content,
    title = null,
    username = null,
    channel = 'chat_1'
} = {}) {
    try {
        const webhookUrl = webhooks[channel]

        if (!webhookUrl) return

        const body = { content }

        if (title !== null) {
            body.username = title
        }

        if (username !== null) {
            body.avatar_url = `https://mc-heads.net/avatar/${username}/64`
        }

        await axios.post(webhookUrl, body)
    } catch {}
}