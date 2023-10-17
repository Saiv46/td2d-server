const assert = require('node:assert/strict')
const Postgres = require('postgres')
const { randomUUID } = require('node:crypto')
const SERVER_UUID = process.env.SERVER_UUID
assert(SERVER_UUID, 'env.SERVER_UUID required')

class Database {
  constructor (server) {
    this.uuid = SERVER_UUID
    this.server = server
    this.sql.listen(`instances:${this.id}:stop`, () => this.server.exit())
  }

  async checkAddressBan (address) {
    const [{ banned }] = await this.sql`SELECT count(*) AS banned FROM players.bannedips WHERE address = ${address}`
    return banned > 0
  }

  async getUserdata (clientid) {
    let results = await this.sql`SELECT * FROM players.userdata WHERE clientid = ${clientid}`
    if (!results.length) {
      results = await this.sql`INSERT INTO players.userdata ${this.sql({
        uuid: randomUUID(),
        clientid
      })} RETURNING *`
    }
    const userdata = results[0]
    return userdata
  }

  async appendPlayerJournal (uuid, username) {
    await this.sql`INSERT INTO players.journal ${this.sql({
      player: uuid,
      username,
      instance: this.uuid
    })}`
  }

  async updatePlayerStats (userdata) {
    await this.sql`UPDATE players.userdata SET ${this.sql({
      statistics: JSON.stringify(userdata.statistics)
    })} WHERE uuid = ${userdata.uuid}`
  }

  async updatePlayerOptions (userdata) {
    await this.sql`UPDATE players.userdata SET ${this.sql({
      options: JSON.stringify(userdata.options)
    })} WHERE uuid = ${userdata.uuid}`
  }

  async discoverRoom (defaultOnly = true) {
    const rooms = await this.sql`SELECT uuid, instance FROM servers.rooms WHERE discoverable AND defaultrules AND instance != ${this.uuid}`
    return rooms[Math.random() * rooms.length | 0]
  }

  async searchRoom (invite) {
    const rooms = await this.sql`SELECT uuid, instance FROM servers.rooms WHERE invite = ${invite}`
    return rooms[0] ?? null
  }

  async addBanEntry ({ uuid: player, address, reason: note }) {
    assert(player, 'uuid required')
    assert(address, 'address required')
    assert(note, 'reason required')
    await this.sql.begin(sql => [
      sql`INSERT INTO moderation.journal ${sql({
        instance: this.uuid,
        action: 'ban',
        player,
        note
      })}`,
      sql`UPDATE players.userdata SET ${sql({ banned: true })} WHERE uuid = ${this.uuid}`,
      sql`INSERT INTO players.bannedips ${sql({ player, address })}`
    ])
  }
}

module.exports = Database
