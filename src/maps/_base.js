const { GameTimers } = require('td2d-protocol')
const TailsProjectile = require('./entities/tailsProjectile')

class BaseMap {
  static Winner = {
    Survivor: 1,
    EXE: -1,
    TimeOver: 0
  }

  constructor (lobby) {
    this.lobby = lobby
    this.ended = false

    this.timeLimit = 30 // 120
    this.escapeTime = 15 // 60
    this.escapeDelay = 5 // 10

    this.started = performance.now()
    this.timer = this.timeLimit
    this.timerStopped = false

    this.escapeStarted = false
    this.escapeCondition = true
    this.escapeActivated = false
    this.escapeRingLocation = Math.floor(Math.random() * 256)

    this.enums = lobby.enums()
    this.limits = lobby.limits()
    this.entities = new Map()
    this.isexe = new WeakMap()
    this.pings = new Map()
    this.positions = new WeakMap()
    this.cooldowns = new WeakMap()
  }

  async activateEscapeSequence () {
    if (this.escapeActivated) return
    this.escapeActivated = true
    this.lobby.broadcast('ServerGameSpawnEscape', { active: false, location: this.escapeRingLocation })
  }

  async startEscapeSequence () {
    if (this.escapeStarted || !this.escapeCondition) return
    this.escapeStarted = true
    this.lobby.broadcast('ServerGameSpawnEscape', { active: true, location: this.escapeRingLocation })
  }

  async endGame (winner = BaseMap.Winner.TimeOver) {
    if (this.timerStopped) return
    this.timerStopped = true
    switch (winner) {
      case BaseMap.Winner.Survivor:
        this.lobby.broadcast('ServerGameSurvivorWin')
        break
      case BaseMap.Winner.EXE:
        this.lobby.broadcast('ServerGameExeWin')
        break
      case BaseMap.Winner.TimeOver:
        this.lobby.broadcast('ServerGameTimeOver')
        break
    }
  }

  async init () {}

  makeCooldown (session, name, timer) {
    const cds = this.cooldowns.get(session)
    if (cds[name] && performance.now() - cds[name] < (timer + 0.5) * 1000) {
      this.lobby.triggerAnticheat(session)
      return false
    }
    cds[name] = performance.now()
    return true
  }

  spawnEntity (Type, params) {
    const entity = new Type(this.entities.size(), params)
    this.entities.set(entity.id, entity)
    entity.onCreated(this)
  }

  removeEntity (id) {
    this.entities.get(id)?.onDestroy(this)
    this.entities.delete(id)
  }

  register (session) {
    this.cooldowns.set(session, {})
    session.on('ClientPing', ({ timestamp, calculated }) => {
      this.pings.set(session.id, calculated >> 1)
      session.writeUdp('ServerPong', { timestamp })
    })
    session.on('PassthroughPlayerState', (state) => {
      if (state.clientId !== session.id) { return this.lobby.triggerAnticheat(session) }
      this.lobby.broadcastUdp('PassthroughPlayerState', state, session)
    })
    switch (this.lobby.characters.get(session)) {
      case 'Tails':
        session.on('ClientTailsProjectileFire', (params) => {
          try {
            if (
              !this.makeCooldown(
                session,
                'projectile',
                TailsProjectile.Cooldown
              )
            ) { throw new Error('TPOJ_COOLDOWN') }
            TailsProjectile.validate(this, params, session)
          } catch (err) {
            return this.lobby.triggerAnticheat(
              session,
              `Validation failed: ${err.message}`
            )
          }
          this.spawnEntity(TailsProjectile, params)
        })
        break
      case 'Knuckles':
      case 'Eggman':
      case 'Amy':
      case 'Cream':
      case 'Sally':
    }
  }

  unregister (session) {
    this.cooldowns.delete(session)
    session.off('ClientPing')
    session.off('PassthroughPlayerState')
    session.off('ClientTailsProjectileFire')
  }

  interval (timer) {
    for (const [clientId, calculated] of this.pings.entries()) {
      this.lobby.broadcastUdp('ServerPlayerPing', { clientId, calculated })
    }
    if (this.timerStopped) {
      if (timer < -7) this.ended = true
      return
    }
    if (this.timer > 0) {
      this.lobby.broadcast(
        'ServerGameTimer',
        Math.floor(
          (timer * GameTimers.TickRate) + (timer / this.timeLimit * GameTimers.TickRate)
        )
      )
    }
    if (!this.escapeStarted && timer <= this.escapeTime) { this.startEscapeSequence() }
    if (!this.escapeActivated && timer <= this.escapeTime - this.escapeDelay) { this.activateEscapeSequence() }
    if (timer <= 0) this.endGame(BaseMap.Winner.TimeOver)

    if (!this.escapeStarted && timer < this.escapeTime) {
      this.startEscapeSequence()
    }
    if (
      !this.escapeActivated &&
      this.escapeCondition &&
      timer < this.escapeTime - this.escapeDelay
    ) {
      this.activateEscapeSequence()
    }
  }

  tick (deltaTime) {
    const timer = this.timeLimit - Math.floor((performance.now() - this.started) / 1000)
    while (timer < this.timer) {
      this.interval(timer)
      this.timer--
    }
    for (const entity of this.entities.values()) {
      entity.onTick(deltaTime)
    }
  }
}

module.exports = BaseMap
