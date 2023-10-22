const { Enums, VersionData, GameTimers } = require('td2d-protocol')
const { KickReasons } = require('../utils/constants')

const FilteredPacketName = 'PassthroughPlayerState'

class BaseLobby {
  constructor (server) {
    this.uuid = crypto.randomUUID()
    this.ac = new AbortController()
    this.server = server
    this.logger = server.logger.extend(`${this.constructor.name}[${this.uuid}]`, '@')
    this.loggerBroadcast = server.loggerBroadcast.extend(`${this.constructor.name}[${this.uuid}]`, '@')
    this.sessions = new Map()
    this.heartbeatLoop().catch(() => {})
    this.logger('Created')
  }

  destroy () {
    this.ac.abort()
    this.server = null
    this.sessions.clear()
    this.logger('Destroyed')
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
    this.logger(`Player #${session.id} joined`)
  }

  onPlayerLeave (session) {
    this.sessions.delete(session.id)
    this.logger(`Player #${session.id} left`)
  }

  chatBroadcast (message, session = null) {
    this.logger('Message from ' + (session ? `#${session.id}` : 'SERVER') + ':', message)
    this.broadcast(
      'PassthroughChatMessage',
      { clientId: session?.id ?? 0, message },
      session
    )
  }

  broadcast (type, data, except = null) {
    if (this.sessions.size && type !== FilteredPacketName) this.loggerBroadcast(type, data, except ? `(excluding #${except.id})` : '')
    const buf = this.server.serializePacket(type, data)
    for (const session of this.sessions.values()) {
      if (session !== except) session.writeRaw(buf)
    }
  }

  broadcastUdp (type, data, except = null) {
    if (type !== FilteredPacketName) this.loggerBroadcast(type, data, except ? `(excluding #${except.id})` : '')
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
    this.logger(`Anticheat triggered by #${session.id} (${session.uuid}): ${reason}`)
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
