const assert = require('node:assert/strict')
const BaseEntity = require('./_base')
const {
  VersionData: {
    100: {
      limits: {
        capabilities: {
          characters: {
            Tails: TailsCapabilities
          }
        }
      }
    }
  }
} = require('td2d-protocol')

class TailsProjectile extends BaseEntity {
  static PacketName = 'ServerTailsProjectileState'
  static Cooldown = TailsCapabilities.projectileRecharge

  constructor (ownerId, { x, y, direction, damage, isExe, charge }) {
    super(ownerId)
    this.x = x
    this.y = y
    this.direction = direction
    this.damage = damage
    this.isExe = isExe
    this.charge = charge
  }

  onCreated (map) {
    map.lobby.broadcast(TailsProjectile.PacketName, {
      action: 'Spawn',
      x: this.x,
      y: this.y,
      owner: this.id,
      direction: this.direction,
      damage: this.damage,
      isExe: this.isExe,
      charge: this.charge
    })
  }

  onTick (map) {
    // TODO proper calculation
    this.y += 16 * this.direction
    map.lobby.broadcast(TailsProjectile.PacketName, {
      action: 'Update',
      x: this.x,
      y: this.y
    })
  }

  onDestroy (map) {
    map.lobby.broadcast(TailsProjectile.PacketName, { action: 'Destroy' })
  }

  static validate (map, params, session) {
    assert.deepEqual(Math.abs(params?.direction), 1, 'TPROJ_DIRECTION')
    assert(params?.damage <= TailsCapabilities.projectileMaxDamage, 'TPROJ_DAMAGE')
    assert(params?.charge <= TailsCapabilities.projectileMaxCharge, 'TPROJ_CHARGE')
    assert(BaseEntity.isPlayerNear(map, params.x, params.y, session), 'TPROJ_POSITION')
    assert.equal(params.isExe, map.isExe.has(session), 'TPROJ_EXE')
  }
}

module.exports = TailsProjectile
