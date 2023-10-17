class BaseEntity {
  constructor (id) {
    this.id = id
  }

  onCreated (map) {}
  onTick (map, deltaTime) {}
  onDestroy (map) {}
  static isPlayerNear (map, x, y, session) {
    const pos = map.positions.get(session)
    if (!pos) return false
    return Math.abs(x - pos.x) < 10 && Math.abs(y - pos.y) < 10
  }
}

module.exports = BaseEntity
