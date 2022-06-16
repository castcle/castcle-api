export class CastcleRegExp {
  static replaceEscapeStrings = (str: string) => {
    return str.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&');
  };

  static fromString = (str: string, caseInsensitive = true) => {
    const strPattern = str.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&');

    return caseInsensitive
      ? new RegExp(`^${strPattern}$`, 'i')
      : new RegExp(`^${strPattern}$`);
  };
}
