const micro = require('micro')
const Router = require('micro-http-router')

function createEndpoint (server) {
  const router = new Router()
  router.get('/', (_, res) => {
    res.setHeader('Location', 'https://td2d.top')
    micro.send(res, 308)
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
    micro.send(res, 200, {
      online: playersOnline,
      lobbies: lobbiesCount,
      queue: playersInQueue
    })
  })
  // TODO: Add metrics
  router.get('/.well-known/td2d-server/metrics', (_, res) =>
    micro.send(res, 404)
  )
  const http = micro((req, res) => router.handle(req, res))
  http.listen(6606)
}

module.exports = createEndpoint
