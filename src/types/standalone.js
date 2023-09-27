const { GameTimers } = require('td2d-protocol')
const BaseLobby = require('./_base')
const ColorString = require('../utils/colorstring')
const { KickReasons } = require('../utils/constants')

class StandaloneLobby extends BaseLobby {
  static DefaultRules = {
    maxLobbyPlayers: 7,
    skipMapVote: false,
    randomCharacters: false,
    uniqueCharacters: false,
    waitEveryoneReady: true
  }

  static ValidateRules (rules) {
    if (rules.maxLobbyPlayers < 1) return 'too few players'
    if (rules.maxLobbyPlayers > 100) return 'too much players'
    if (rules.uniqueCharacters && rules.maxLobbyPlayers > 7) return 'not enough characters'
    return null
  }

  constructor (server) {
    super(server)
    this.rules = structuredClone(StandaloneLobby.DefaultRules)
    this.waiting = false
    this.selectedEXE = null
    this.selectedMap = null
    this.mapState = null
    this.characters = new WeakMap()
    this.allowedMaps = Object.keys(this.enums().maps.byName).filter(v => v !== 'FartZone')
    this.countdownLoop()
  }

  destroy (graceful = false) {
    if (!graceful) this.chatBroadcast(`${ColorString.RED}lobby was destroyed`)
    for (const session of this.sessions.values()) {
      session.joinLobby(this.server.defaultLobby)
    }
    this.rules = null
    this.selectedEXE = null
    this.selectedMap = null
    this.mapState = null
    this.allowedMaps = null
    this.server.normalLobbies.delete(this)
    super.destroy()
  }

  get isAvailable () {
    return this.waiting && this.sessions.size < this.rules.maxLobbyPlayers
  }

  async countdownLoop () {
    this.waiting = true
    let timer = 5
    // eslint-disable-next-line no-unused-vars
    for await (const _ of GameTimers.steadyInterval(null, this.ac.signal)) {
      if (!this.sessions.size) return this.destroy()
      if (!timer) break
      this.broadcast('ServerCountdown', { isCounting: true , inSeconds: timer-- })
    }
    this.mapVoteLoop()
  }

  async mapVoteLoop () {
    this.waiting = false
    const voteResults = [0, 0, 0]
    const maps = this.allowedMaps.sort(() => Math.sign(Math.random() - 0.5)).slice(0, 3)
    const pendingVotes = new Set(this.sessions.values())
    for (const session of pendingVotes) {
      session.once('ClientMapVote', index => {
        voteResults[index]++
        pendingVotes.delete(session)
        session.write('ServerVoteResults', voteResults)
      })
    }
    this.broadcast('ServerVoteMaps', maps.map(v => this.enums().maps.byName[v]))
    let timer = 30
    // eslint-disable-next-line no-unused-vars
    for await (const _ of GameTimers.steadyInterval(null, this.ac.signal)) {
      if (!this.sessions.size) return this.destroy()
      if (!timer) break
      if (!pendingVotes.size && timer > 5) timer = 5
      this.broadcast('ServerVoteTimer', timer--)
    }
    const votes = Math.max(...voteResults)
    const index = voteResults.indexOf(votes)
    const index2 = voteResults.lastIndexOf(votes)
    this.selectedMap = maps[Math.random() < 0.5 ? index : index2]
    for (const session of pendingVotes) {
      session.off('ClientMapVote')
      pendingVotes.delete(session)
    }
    this.characterSelectLoop()
  }

  async characterSelectLoop () {
    const ids = Array.from(this.sessions.keys())
    const charsTaken = []
    this.selectedEXE = ids[Math.random() * ids.length | 0]
    this.broadcast('ServerCharSelectStart', {
      currentEXE: this.selectedEXE,
      selectedMap: this.enums().maps.byName[this.selectedMap]
    })
    for (const session of this.sessions.values()) {
      this.characters.delete(session)
      if (session.id === this.selectedEXE) {
        session.once('ClientExeCharacterRequest', characterId => {
          const character = this.enums().exeCharacters.byId[characterId]
          if (!character) return this.triggerAnticheat(session)
          charsTaken.push(-characterId)
          session.write('ServerExeCharacterSuccess', characterId)
          this.broadcast('ServerCharSelectUpdate', { clientId: session.id, characterId }, session)
          this.characters.set(session, character)
        })
      } else {
        session.once('ClientCharacterRequest', characterId => {
          const character = this.enums().characters.byId[characterId]
          if (!character) return this.triggerAnticheat(session)
          if (this.rules.uniqueCharacters && charsTaken.has(characterId)) {
            session.write('ServerCharacterResponse', { characterId, success: false })
            return
          }
          charsTaken.push(characterId)
          session.write('ServerCharacterResponse', { characterId, success: true })
          this.broadcast('ServerCharSelectUpdate', { clientId: session.id, characterId }, session)
          this.characters.set(session, character)
        })
      }
    }
    let timer = 30
    // eslint-disable-next-line no-unused-vars
    for await (const _ of GameTimers.steadyInterval(null, this.ac.signal)) {
      if (!this.sessions.size) return this.destroy()
      if (!timer || charsTaken.length === this.sessions.size) break
      this.broadcast('ServerCharSelectTimer', timer--)
    }
    for (const session of this.sessions.values()) {
      if (this.characters.has(session)) {
        session.off('ClientCharacterRequest')
        session.off('ClientExeCharacterRequest')
      } else session.disconnect(KickReasons.AfkTimeout)
    }
    this.gameLoop()
  }

  async gameLoop () {
    this.broadcast('ServerGameStart')
    try {
      this.mapState = new Map(this)
      await this.mapState.init()
    } catch (e) {
      this.broadcast('ServerReturnToLobby')
      console.trace(e)
      this.chatBroadcast(`${ColorString.RED}Map failed to load:`)
      this.chatBroadcast(ColorString.RED + e.message)
      countdownLoop()      
      return
    }
    for (const session of this.sessions.values()) {
      this.mapState.register(session)
    }
    this.broadcast('ServerMapLoaded')
    for await (const deltaTime of GameTimers.dynamicTick(this.ac.signal)) {
      if (!this.sessions.size) return this.destroy()
      this.mapState.tick(deltaTime)
      if (this.mapState.ended) break
    }
    for (const session of this.sessions.values()) {
      this.mapState.unregister(session)
    }
    this.broadcast('ServerReturnToLobby')
    this.destroy(true)
  }

  onChatMessage (session, message) {
    const plain = ColorString.toPlainString(message)
    if (plain.startsWith('.')) {
      switch (plain) {
        case '.h':
        case '.help':
          session.chat(`${ColorString.WHITE}Press ${ColorString.YELLOW}ready ${ColorString.WHITE}to exit lobby`)
          break
        case '.p':
        case '.practice':
          session.chat(`${ColorString.RED}exit lobby first`)
          break
        default:
          session.chat(`${ColorString.RED}unknown command`)
      }
      return
    }
    this.chatBroadcast(message, session)
  }

  onPlayerReady (session, isReady) {
    if (!isReady) {
      session.joinLobby(this.server.defaultLobby)
    }
  }

  onPlayerJoin (session) {
    this.broadcast('ServerPlayerJoined', session.id)
    this.broadcast('ServerPlayerInfo', { clientId: session.id, ...session.identity })
    this.broadcast('ServerReadyState', { clientId: session.id, isReady: true })
    for (const [clientId, session2] of this.sessions.entries()) {
      session.write('ServerPlayerJoined', clientId)
      session.write('ServerPlayerInfo', { clientId, ...session2.identity })
      session.write('ServerReadyState', { clientId, isReady: true })
    }
    super.onPlayerJoin(session)
  }

  onPlayerLeave (session) {
    super.onPlayerLeave(session)
    for (const clientId of this.sessions.keys()) {
      session.write('ServerPlayerLeft', clientId)
    }
    this.broadcast('ServerPlayerLeft', session.id)
  }
}

module.exports = StandaloneLobby
