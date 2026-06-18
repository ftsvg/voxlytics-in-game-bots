export function waitForSpawn(bot, lobby) {
  return new Promise(resolve => {
    const joinLobby = () => {
      bot.chat(`/server bwp-lobby-${lobby}`)
      resolve()
    }

    if (bot.player) return joinLobby()
    bot.once('spawn', joinLobby)
  })
}