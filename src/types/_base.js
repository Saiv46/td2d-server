const { Enums, VersionData, GameTimers } = require('td2d-protocol')
const { KickReasons } = require('../utils/constants')

class BaseLobby {
  constructor (server) {
    this.uuid = crypto.randomUUID()
    this.ac = new AbortController()
    this.server = server
    this.sessions = new Map()
    this.heartbeatLoop().catch(() => {})
  }

  destroy () {
    this.ac.abort()
    this.server = null
    this.sessions.clear()
  }

  async heartbeatLoop () {
    // eslint-disable-next-line no-unused-vars
    for await (const _ of GameTimers.steadyInterval(2, this.ac.signal)) {
      this.broadcast('ServerHeartbeat')
    }
  }

  onLobbyRequest () {}
  onPlayerReady () {}

  onPlayerJoin (session) {
    this.sessions.set(session.id, session, this.constructor.name)
  }

  onPlayerLeave (session) {
    this.sessions.delete(session.id)
  }

  chatBroadcast (message, session = null) {
    this.broadcast(
      'PassthroughChatMessage',
      { clientId: session?.id ?? 0, message },
      session
    )
  }

  broadcast (type, data, except = null) {
    const buf = this.server.serializePacket(type, data)
    for (const session of this.sessions.values()) {
      if (session !== except) session.writeRaw(buf)
    }
  }

  broadcastUdp (type, data, except = null) {
    const buf = this.server.serializePacketUdp(type, data)
    for (const session of this.sessions.values()) {
      if (session !== except) session.writeUdpRaw(buf)
    }
  }

  enums () {
    return Enums[this.server.options.version]
  }

  limits () {
    return VersionData[this.server.options.version].limits
  }

  triggerAnticheat (session, reason) {
    this.server.database.addBanEntry({
      uuid: session.uuid,
      username: session.username,
      address: session.address,
      reason
    })
    session.disconnect(KickReasons.Banned)
  }
}

module.exports = BaseLobby
