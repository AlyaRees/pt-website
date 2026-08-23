import xss from "xss"

export function stripField(fieldInput :string) {
    return xss(fieldInput,
    {
      whiteList: {},
      stripIgnoreTag: true
    }
  ).trim()
}