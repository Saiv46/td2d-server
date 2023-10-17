const { once } = require('node:events')
const timers = require('node:timers/promises')
const { createServer } = require('td2d-protocol')
const ClientSession = require('./session')
const { KickReasons } = require('./utils/constants')
const ColorString = require('./utils/colorstring')
const processIdentity = require('./utils/identity')
const DefaultLobby = require('./types/default')

async function makeServer () {
  const server = await createServer()
  server.defaultLobby = new DefaultLobby(server)
  server.normalLobbies = new Set()
  server.inviteLobbies = new Map()
  server.database = new Database(server)

  server.on('connection', async client => {
    const identity = await Promise.race([
      once(client, 'ClientIdentity', { signal: client.abortController.signal })
        .then(([identity]) => processIdentity(identity, server.options.version)),
      timers.setTimeout(server.options.timeout, undefined, { signal: client.abortController.signal })
    ])
    if (!identity) {
      client.write('ServerDisconnectReason', identity === null ? KickReasons.Kicked : KickReasons.ConnectTimeout)
      return client.destroy()
    }
    const session = new ClientSession(client, identity)
    session.joinLobby(server.defaultLobby).catch(() => session.disconnect())
  })
  server.on('error', err => console.trace('Server unhandled error:', err))
  server.once('close', err => {
    console.log('Server closed, reason:', err)
    process.exit(err ? 1 : 0)
  })
  process.once('SIGINT', async () => {
    if (server.clients.size) {
      server.broadcast('ServerReturnToLobby')
      for (let i = 5; i > -1; i--) {
        await timers.setTimeout(1000)
        server.broadcast('PassthroughChatMessage', { clientId: 0, message: `${ColorString.RED}server shuts down in ${i}` })
      }
      server.broadcast('ServerDisconnectReason', KickReasons.Kicked)
    }
    server.destroy()
  })
}

makeServer().catch(err => {
  console.trace(err)
  process.exit(1)
})
