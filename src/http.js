const { Server } = require('http')
const { serve, send } = require('micro')
const Router = require('micro-http-router')

function createEndpoint (server) {
  const router = new Router()
  router.get('/', (_, res) => {
    res.setHeader('Location', 'https://td2d.top')
    send(res, 308)
  })
  router.get('/.well-known/td2d-server/ping', (_, res) => {
    const playersInQueue = server.defaultLobby.queue.size
    const lobbiesCount =
      1 + server.normalLobbies.size + server.inviteLobbies.size
    let playersOnline = server.defaultLobby.sessions.size
    for (const lobby of server.normalLobbies.values()) {
      playersOnline += lobby.sessions.size
    }
    for (const lobby of server.inviteLobbies.values()) {
      playersOnline += lobby.sessions.size
    }
    res.setHeader('Access-Control-Allow-Origin', '*')
    send(res, 200, {
      online: playersOnline,
      lobbies: lobbiesCount,
      queue: playersInQueue
    })
  })
  // TODO: Add metrics
  router.get('/.well-known/td2d-server/metrics', (_, res) => send(res, 404))
  router.get('/.well-known/td2d-server/query', (req, res) => {
    if (req.headers.authorization !== 'Bearer ' + server.database.token) { return send(res, 403) }
    const lobbies = []
    lobbies.push({
      uuid: null,
      players: Array.from(server.defaultLobby.sessions, (v) => v.identity)
    })
    for (const lobby of server.normalLobbies.values()) {
      lobbies.push({
        uuid: lobby.uuid,
        players: Array.from(lobby.sessions, (v) => v.identity)
      })
    }
    for (const [invite, lobby] of server.inviteLobbies.entries()) {
      lobbies.push({
        uuid: lobby.uuid,
        invite,
        players: Array.from(lobby.sessions, (v) => v.identity)
      })
    }
  })
  const http = new Server(serve((req, res) => router.handle(req, res).catch(() => send(res, 404))))
  http.listen(6606)
}

module.exports = createEndpoint
