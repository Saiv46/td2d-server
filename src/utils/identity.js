const assert = require('node:assert/strict')
const { Enums } = require('td2d-protocol')
const ColorString = require('./colorstring')

function processIdentity (identity, version) {
  const { icons, pets, os } = Enums[version]
  try {
    assert.equal(identity.version, version)
    assert(identity.username = ColorString.normalize(identity.username))
    assert(identity.uuid = identity.uuid.trim())
    assert(identity.icon = icons.byId[identity.icon])
    assert(identity.pet = pets.byId[identity.pet])
    assert(identity.os = os.byId[identity.os])
    return identity
  } catch (e) {
    console.trace(e)
    return null
  }
}

module.exports = processIdentity
