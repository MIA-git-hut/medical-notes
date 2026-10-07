export interface CatalogStar {
  hip: number
  ra: number
  dec: number
  magnitude: number
}

/** Local gnomonic chart: north up, east left. One uniform scale per asterism. */
export function projectAsterism(stars: readonly CatalogStar[], extent = 46) {
  if (stars.length < 2) throw new Error('An asterism needs at least two catalog stars')
  const radians = Math.PI / 180
  const vectors = stars.map(star => {
    if (![star.ra, star.dec, star.magnitude].every(Number.isFinite)) throw new Error(`Invalid HIP ${star.hip}`)
    const ra = star.ra * radians, dec = star.dec * radians
    return { star, ra, dec, x: Math.cos(dec) * Math.cos(ra), y: Math.cos(dec) * Math.sin(ra), z: Math.sin(dec) }
  })
  const sum = vectors.reduce((a, v) => ({ x: a.x + v.x, y: a.y + v.y, z: a.z + v.z }), { x: 0, y: 0, z: 0 })
  const ra0 = Math.atan2(sum.y, sum.x)
  const dec0 = Math.atan2(sum.z, Math.hypot(sum.x, sum.y))
  const projected = vectors.map(({ star, ra, dec }) => {
    const delta = ra - ra0
    const denominator = Math.sin(dec0) * Math.sin(dec) + Math.cos(dec0) * Math.cos(dec) * Math.cos(delta)
    if (denominator <= 0) throw new Error('Asterism exceeds a local tangent hemisphere')
    return { ...star,
      x: -Math.cos(dec) * Math.sin(delta) / denominator,
      y: -(Math.cos(dec0) * Math.sin(dec) - Math.sin(dec0) * Math.cos(dec) * Math.cos(delta)) / denominator,
    }
  })
  const minX = Math.min(...projected.map(s => s.x)), maxX = Math.max(...projected.map(s => s.x))
  const minY = Math.min(...projected.map(s => s.y)), maxY = Math.max(...projected.map(s => s.y))
  const scale = extent / Math.max(maxX - minX, maxY - minY)
  if (!Number.isFinite(scale)) throw new Error('Coincident star coordinates')
  return projected.map(star => ({ ...star,
    x: (star.x - (minX + maxX) / 2) * scale,
    y: (star.y - (minY + maxY) / 2) * scale,
  }))
}
