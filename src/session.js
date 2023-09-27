const ColorString = require("./utils/colorstring")

class ClientSession {
  constructor (client, identity) {
    this.id = (Math.random() * 0xffff) | 0
    this.lobby = null
    this.client = client
    this.identity = identity
    this.write('ServerStatus', { isLobby: true, clientId: this.id })
    this.once('ClientPlayerInfoRequest', () => this.lobby?.onLobbyRequest(this))
    this.on('ClientLobbyReady', isReady => this.lobby?.onPlayerReady(this, isReady))
    this.on('PassthroughChatMessage', ({ sender, message }) => {
      if (sender !== this.id) return this.lobby?.triggerAnticheat(this)
      this.lobby?.onChatMessage(this, message)
    })
    this.once('close', () => this.lobby?.onPlayerLeave(this))
  }

  get address () {
    return this.client.tcpSocket.remoteAddress
  }
  get uuid () {
    return this.identity.uuid
  }
  get username () {
    return this.identity.username
  }
  get plainUsername () {
    return ColorString.toPlainString(this.username)
  }

  on (type, func) {
    this.client.on(type, func)
  }

  once (type, func) {
    this.client.once(type, func)
  }

  off (type, func) {
    if (func) {
      this.client.off(type, func)
    } else this.client.removeAllListeners(type)
  }

  chat (message, client = null) {
    const clientId = client?.id ?? 0
    for (const line of message.split('\n')) {
      this.write('PassthroughChatMessage', { clientId, message: line })
    }
  }

  async joinLobby (lobby) {
    await lobby.onPlayerJoin(this)
    await this.lobby?.onPlayerLeave(this)
    this.lobby = lobby
  }

  write (type, data) {
    return this.client.write(type, data)
  }

  writeRaw (buf) {
    return this.client.writeRaw(buf)
  }

  writeUdp (type, data) {
    return this.client.writeUdp(type, data)
  }

  writeUdpRaw (buf) {
    return this.client.writeUdpRaw(buf)
  }

  disconnect (reason = '') {
    this.write('ServerDisconnectReason', reason)
    this.client.destroy()
  }
}

module.exports = ClientSession
