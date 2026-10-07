import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const directory = path.join(root, 'content/astronomy')
const mapping = JSON.parse(fs.readFileSync(path.join(directory, 'stellarium-mansions.json'), 'utf8'))
const rows = fs.readFileSync(path.join(directory, 'hipparcos.tsv'), 'utf8').split(/\r?\n/)
const stars = new Map(rows.filter(row => /^\s*\d+\t/.test(row)).map(row => {
  const [hip, ra, dec, magnitude] = row.trim().split(/\s+/).map(Number)
  if (![hip, ra, dec, magnitude].every(Number.isFinite)) throw new Error(`Invalid catalog row: ${row}`)
  return [hip, { hip, ra, dec, magnitude }]
}))
const mansions = mapping.mansions.map(mansion => ({
  name: mansion.name,
  lines: mansion.lines,
  missingOrdinals: [...(mansion.unmappedTraditionalOrdinals ?? []), ...(mansion.tentativePrincipalCandidates ?? []).map(candidate => candidate.ordinal)],
  stars: mansion.principalHipIds.map(hip => {
    const star = stars.get(hip)
    if (!star) throw new Error(`Missing Hipparcos position for ${mansion.name}: ${hip}`)
    return star
  }),
}))
const output = { positionSource: 'ESA 1997, Hipparcos I/239/hip_main; ICRS, epoch J1991.25',
  lineSource: mapping.source.indexUrl, mansions }
fs.writeFileSync(path.join(directory, 'mansions.json'), JSON.stringify(output, null, 2) + '\n')
console.log(`Built ${mansions.length} catalog-backed asterisms`)
