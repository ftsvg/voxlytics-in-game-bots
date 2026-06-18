import axios from 'axios'
import 'dotenv/config'

const discordWebhookUrl = process.env.WEBHOOK_URL

export async function sendWebhook(title, description, color, fields) {
    try {
        await axios.post(discordWebhookUrl, {
            embeds: [
                {
                    title,
                    description,
                    color,
                    fields
                }
            ]
        })
    } catch {}
}