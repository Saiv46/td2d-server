const ColorString = require('../utils/colorstring')
const StandaloneLobby = require('./standalone')

class InviteLobby extends StandaloneLobby {
  static MinID = parseInt('100', 36)
  static MaxID = parseInt('zzz', 36)
  static generateInvite () {
    return Math.random() * (this.MaxID - this.MinID) + this.MinID
  }

  constructor (server, invite) {
    super(server)
    this.invite = invite
  }

  destroy () {
    for (const session of this.sessions.values()) {
      session.joinLobby(this.server.defaultLobby)
    }
    this.rules = null
    this.selectedEXE = null
    this.selectedMap = null
    this.mapState = null
    this.allowedMaps = null
    this.server.inviteLobbies.delete(this.invite)
    super.destroy()
  }

  onLobbyRequest (session) {
    session.write('ServerLobbyLoaded')
    session.chat(
      `\n${ColorString.WHITE}----------------------\n` +
        `${ColorString.ORANGE}tell your friends to type\n` +
        `${ColorString.WHITE}this invite code: ${
          ColorString.GREEN
        }${this.invite.toString(36)}` +
        `\n${ColorString.WHITE}----------------------\n`
    )
  }

  onPlayerJoin (session) {
    super.onPlayerJoin(session)
    this.onLobbyRequest(session)
  }
}

module.exports = InviteLobby
