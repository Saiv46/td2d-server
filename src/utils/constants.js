const KickReasons = {
  AfkTimeout: 'AFK or Timeout',
  Banned: 'Banned by server.',
  ConnectTimeout: 'Connection timeout',
  IPBanned: 'You were banned from this server.',
  InvalidPacket: 'Packet overload > 256',
  InvalidSession: 'invalid session',
  Kicked: 'Kicked by server.',
  LobbyFull: 'Server is full. (7/7)',
  UdpTimeout: 'UDP packets didnt arrive in time',
  VersionMismatch: 'Wrong game version ({} required, but got {})',
  VoteKicked: 'Vote kick.'
}

module.exports = {
  KickReasons
}
