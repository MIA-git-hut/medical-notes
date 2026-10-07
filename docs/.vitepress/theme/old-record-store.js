export const OLD_RECORD_VALUES = new Set(['know', 'unknown'])

/** Parse the legacy local-only record map and discard malformed or polluted data. */
export function parseOldRecords(serialized) {
  if (typeof serialized !== 'string' || serialized.length === 0) return {}
  let value
  try {
    value = JSON.parse(serialized)
  } catch {
    return {}
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return {}
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) return {}

  const records = {}
  for (const [name, status] of Object.entries(value)) {
    if (!['__proto__', 'prototype', 'constructor'].includes(name) && OLD_RECORD_VALUES.has(status)) records[name] = status
  }
  return records
}
