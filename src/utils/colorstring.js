class ColorString {
  static RED = '\\'
  static ORANGE = '№'
  static YELLOW = '`'
  static GREEN = '@'
  static BLUE = '/'
  static PURPLE = '&'
  static WHITE = '~'
  static BLACK = '|'

  static ColorCodes = this.RED + this.ORANGE + this.YELLOW + this.GREEN + this.BLUE + this.PURPLE + this.WHITE + this.BLACK
  static ColorCodesRegexp = new RegExp(`[${this.ColorCodes.replace('\\', '\\\\')}]+`, 'g')
  static UnsupportedCharacters = new RegExp(`[^0-9a-zа-я,.'%?${this.ColorCodes.replace('\\', '\\\\')}]+`, 'g')
  static RepeatingColorCodes = new RegExp(`[${this.ColorCodes.replace('\\', '\\\\')} ]{2,}`, 'g')

  static toPlainString (str) {
    return this.normalize(str.replaceAll(this.ColorCodesRegexp, ''))
  }

  static normalize (str) {
    return str.replaceAll(this.UnsupportedCharacters, '').replaceAll(this.RepeatingColorCodes, m => m.at(-1)).trim()
  }
}

module.exports = ColorString
