import fs from 'fs'

const MESSAGE_ID_FILE = './msg.txt'

export function loadMessageId() {
    try {
        if (fs.existsSync(MESSAGE_ID_FILE)) {
            const id = fs.readFileSync(MESSAGE_ID_FILE, 'utf8').trim()
            return id || null
        }
    } catch (error) {
        console.error('Error loading message ID:', error)
    }
    return null
}

export function saveMessageId(messageId) {
    try {
        fs.writeFileSync(MESSAGE_ID_FILE, messageId)
    } catch (error) {
        console.error('Error saving message ID:', error)
    }
}