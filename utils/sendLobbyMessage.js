import axios from 'axios'
import 'dotenv/config'

const discordWebhookUrl = process.env.WEBHOOK_URL_CHAT

export async function sendLobbyMessage({ content, title = null, username = null } = {}) {
    try {
        const body = { content }

        if (title !== null) {
            body.username = title
        }

        if (username !== null) {
            body.avatar_url = `https://mc-heads.net/avatar/${username}/64`
        }

        await axios.post(discordWebhookUrl, body)
    } catch {}
}