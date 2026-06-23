import { createBot } from 'mineflayer'
import { waitForSpawn } from './utils/spawn.js'
import { checkNicks } from './denicker/checkNicks.js'
import { WatchLobby } from './utils/lobbyChat.js'
import { startNickExpiry } from './denicker/nickExpiry.js'
import { startLobbyTracker } from './utils/lobbyTracker.js'
import { startTablist } from './utils/tablist.js'
import { startServerStats } from './utils/serverStats.js'

const BOTS = [
    { username: process.env.BOT_1, lobby: 1 },
    { username: process.env.BOT_2, lobby: 2 }
]

const RECONNECT_DELAY = 5000

startNickExpiry()

for (const config of BOTS) {
    startBot(config)
}

function startBot(config) {
    const { username, lobby } = config

    console.log(`[${username}] creating bot...`)

    const bot = createBot({
        host: 'voxyl.net',
        username,
        auth: 'microsoft'
    })

    bot.lobby = lobby

    bot.once('spawn', async () => {
        console.log(`[${username}] spawned`)

        await waitForSpawn(bot, lobby)
        await WatchLobby(bot, lobby)

        console.log(`[${username}] joined lobby ${lobby}`)
        checkNicks(bot)
        startLobbyTracker(bot, lobby)
        startTablist(bot, lobby)
        startServerStats(bot, lobby)
    })

    const reconnect = (reason) => {
        console.log(`[${username}] disconnected:`, reason)
        setTimeout(() => startBot(config), RECONNECT_DELAY)
    }

    bot.on('kicked', reconnect)
    bot.on('end', reconnect)
    bot.on('error', err => {
        console.log(`[${username}] error:`, err)
    })
}