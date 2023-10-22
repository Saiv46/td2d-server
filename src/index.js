const debug = require('debug')('td2d-server')
const { once } = require('node:events')
const timers = require('node:timers/promises')
const { createServer } = require('td2d-protocol')
const ClientSession = require('./session')
const { KickReasons } = require('./utils/constants')
const ColorString = require('./utils/colorstring')
const processIdentity = require('./utils/identity')
const DefaultLobby = require('./types/default')
const Database = require('./database')
const createEndpoint = require('./http')

const debugBroadcast = debug.extend('broadcast')

async function makeServer () {
  const server = await createServer()
  server.logger = debug
  server.loggerBroadcast = debugBroadcast
  server.defaultLobby = new DefaultLobby(server)
  server.normalLobbies = new Set()
  server.inviteLobbies = new Map()
  server.database = new Database(server)
  server.endpoint = createEndpoint(server)
  server.exit = async () => {
    server.exit = () => {}
    if (server.clients.size) {
      server.broadcast('ServerReturnToLobby')
      for (let i = 5; i > -1; i--) {
        await timers.setTimeout(1000)
        server.broadcast('PassthroughChatMessage', { clientId: 0, message: `${ColorString.RED}server shuts down in ${i}` })
      }
      server.broadcast('ServerDisconnectReason', KickReasons.Kicked)
    }
    server.destroy()
  }

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
    const session = new ClientSession(client)
    const isIPBanned = await server.database.checkAddressBan(session.address)
    if (isIPBanned) return session.disconnect(KickReasons.Banned)
    const userdata = await server.database.getUserdata(identity.uuid)
    if (userdata.banned) {
      return session.disconnect(KickReasons.Banned)
    }
    session.identity = identity
    session.userdata = userdata
    server.database.appendPlayerJournal(userdata.uuid, session.username)
    session.joinLobby(server.defaultLobby).catch(() => session.disconnect())
  })
  server.on('error', err => console.trace('Server unhandled error:', err))
  server.once('close', err => {
    console.log('Server closed, reason:', err)
    process.exit(err ? 1 : 0)
  })

  process.once('SIGINT', () => server.exit())
}

makeServer().catch(err => {
  console.trace(err)
  process.exit(1)
})
