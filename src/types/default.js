const { GameTimers } = require('td2d-protocol')
const BaseLobby = require('./_base')
const ColorString = require('../utils/colorstring')
const StandaloneLobby = require('./standalone')

class DefaultLobby extends BaseLobby {
  static NormalQueueWaitTime = 5 * 1000
  static Motds = [
    'me when the skill is issue:',
    'славянский зажим читами',
    'e',
    'pro tip: press z to jump',
    `welcome to ${ColorString.RED}hell`,
    `${ColorString.BLACK}someone was summoned`,
    `hello ${ColorString.YELLOW}cheese ${ColorString.GREEN}eater`,
    `${ColorString.YELLOW}run ${ColorString.PURPLE}think ${ColorString.RED}stun ${ColorString.GREEN}live`,
    `${ColorString.RED}snick ${ColorString.GREEN}is coming...`,
    'pro tip: dont die',
    '14000 ms ping',
    'i suck playing as exe',
    'press alt+f4 to get moony'
  ].map(v => ColorString.GREEN + '- ' + v)

  constructor (server) {
    super(server)
    this.queue = new Set()
    this.queueTime = new WeakMap()
    this.currentMotd = ''
    this.queueLoop()
    this.motdLoop()
  }

  async queueLoop () {
    // eslint-disable-next-line no-unused-vars
    for await (const _ of GameTimers.steadyInterval(null, this.ac.signal)) {
      if (!this.queue.size) continue
      while (this.queue.size >= 1) {
        const queue = this.queue.values()
        const lobby = new StandaloneLobby(this.server)
        const promises = []
        for (let i = 0; i < 7; i++) {
          const { value: session, done } = queue.next()
          if (done) break
          this.queue.delete(session)
          session.chat(`\n${ColorString.GREEN}players found\n${ColorString.WHITE}creating a lobby...\n`)
          promises.push(session.joinLobby(lobby))
        }
        await Promise.allSettled(promises)
      }
      for (const session of this.queue.values()) {
        if (this.queueTime.has(session)) continue
        for (const lobby of this.server.normalLobbies.values()) {
          if (lobby.isAvailable) {
            session.joinLobby(lobby)
            break
          }
        }
      }
      for (const session of this.queue.values()) {
        if (Date.now() - this.queueTime.get(session) > DefaultLobby.NormalQueueWaitTime) {
          this.queueTime.delete(session)
          session.chat(
            `\n${ColorString.RED}not enough players` +
            `\n${ColorString.WHITE}please be patient...\n`
          )
        }
      }
    }
  }

  async motdLoop () {
    // eslint-disable-next-line no-unused-vars
    for await (const _ of GameTimers.steadyInterval(60, this.ac.signal)) {
      const nextMotd = DefaultLobby.Motds[Math.random() * DefaultLobby.Motds.length | 0]
      if (nextMotd !== this.currentMotd) this.chatBroadcast(this.currentMotd = nextMotd)
    }
  }

  onLobbyRequest (session) {
    session.lobbyRequested = true
    session.write('ServerLobbyLoaded')
    session.chat(
      `\n${ColorString.WHITE}welcome\n` +
      `${ColorString.WHITE}press ${ColorString.YELLOW}ready ${ColorString.WHITE}to find game\n` +
      `${ColorString.WHITE}type ${ColorString.PURPLE}.invite ${ColorString.WHITE}to create lobby\n\n` +
      this.currentMotd + '\n'
    )
  }
  /*
  'strings.invite' = new LiveString(
    '~----------------------'
    + '№tell your friends to type'
    + '№this invite code: @{invite}'
    + '~----------------------'
  )
  'strings.full' = new LiveString('\\cannot join by invite\n\\lobby is full')
  */

  onChatMessage (session, message) {
    message = ColorString.toPlainString(message)
    if (message.startsWith('.')) {
      switch (message) {
        case '.a':
        case '.amogus':
          session.chat(`%%%%%%#######%%%%%%%%%%%%%
      %%%%%###@@@@@#%%%%%%%%%%%%
      %%######@@@@@#%%%%%%%%%%%%
      %%############=====================================================
      %%############=====================================================
      %%%%%###%%%###%%%%%%%%%%%%
      %%%%%###%%%###%%%%%%%%%%%%
      %%%%%###%%%###%%%%%%%%%%%%`
            .replaceAll(' ', '')
            .replaceAll(/%+/g, v => ColorString.BLACK + v)
            .replaceAll(/#+/g, v => ColorString.RED + '%'.repeat(v.length))
            .replaceAll(/@+/g, v => ColorString.BLUE + '%'.repeat(v.length))
            .replaceAll(/=+/g, v => ColorString.ORANGE + '%'.repeat(v.length)))
          break
        case '.h':
        case '.help':
          session.chat(`${ColorString.PURPLE}.invite ${ColorString.WHITE}- сreate invite-only lobby`)
          break
        case '.p':
        case '.practice':
          // TODO: Practice
          session.chat(`${ColorString.RED}`)
          break
        case '.i':
        case '.invite':
          session.chat(`${ColorString.RED}feature not ready`)
          break
        default:
          session.chat(`${ColorString.RED}unknown command`)
      }
      return
    }
    if (message.length === 3) {
      const lobby = parseInt(message, 36)
      if (!Number.isNaN(lobby)) {
        // TODO: lobby find
      }
    }
    if (!this.queue.has(session)) return session.chat(`${ColorString.RED}Find game to chat`)
    for (const session2 of this.queue.values()) {
      if (session2 !== session) session2.chat(`${ColorString.BLUE}queue: ${ColorString.BLACK}` + message)
    }
  }

  onPlayerReady (session, isReady) {
    if (isReady) {
      this.queue.add(session)
      this.queueTime.set(session, Date.now())
      session.chat(
        `\n${ColorString.ORANGE}searching for players...\n` +
        `${ColorString.WHITE}press ${ColorString.YELLOW}ready ${ColorString.WHITE}to stop\n`
      )
    } else {
      this.queue.delete(session)
      this.onLobbyRequest(session)
    }
  }

  onPlayerJoin (session) {
    super.onPlayerJoin(session)
    if (session.lobbyRequested) this.onLobbyRequest(session)
  }

  onPlayerLeave (session) {
    super.onPlayerLeave(session)
    this.queue.delete(session)
  }
}

module.exports = DefaultLobby
