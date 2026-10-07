import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { projectAsterism } from '../shared/star-projection'

const catalog = JSON.parse(fs.readFileSync(new URL('../content/astronomy/mansions.json', import.meta.url), 'utf8'))
const mapping = JSON.parse(fs.readFileSync(new URL('../content/astronomy/stellarium-mansions.json', import.meta.url), 'utf8'))
const positions = new Map(fs.readFileSync(new URL('../content/astronomy/hipparcos.tsv', import.meta.url), 'utf8').split(/\r?\n/)
  .filter(row => /^\s*\d+\t/.test(row)).map(row => {
    const [hip, ra, dec, magnitude] = row.trim().split(/\s+/).map(Number)
    return [hip, { hip, ra, dec, magnitude }]
  }))

test('star charts preserve catalog membership and never connect removed auxiliary stars', () => {
  assert.equal(catalog.mansions.length, 28)
  for (const mansion of catalog.mansions) {
    const source = mapping.mansions.find((m: any) => m.name === mansion.name)
    assert.deepEqual(mansion.stars.map((s: any) => s.hip), source.principalHipIds)
    for (const star of mansion.stars) assert.deepEqual(star, positions.get(star.hip))
    const originalEdges = new Set(source.sourceLines.flatMap((line: number[]) => line.slice(1).map((hip, i) => `${line[i]}-${hip}`)))
    for (const line of mansion.lines) for (let i = 1; i < line.length; i++) {
      assert.ok(originalEdges.has(`${line[i - 1]}-${line[i]}`), `${mansion.name}: invented edge`)
      assert.ok(source.principalHipIds.includes(line[i - 1]) && source.principalHipIds.includes(line[i]))
    }
    const projected = projectAsterism(mansion.stars)
    assert.ok(projected.every(s => Number.isFinite(s.x) && Number.isFinite(s.y)))
  }
  const count = (name: string) => catalog.mansions.find((m: any) => m.name === name).stars.length
  assert.equal(count('角'), 2)
  assert.equal(count('心'), 3)
  assert.equal(count('参'), 7)
  assert.equal(count('奎'), 16)
  assert.equal(count('轸'), 4)
  assert.equal(count('翼'), 15)
  assert.equal(catalog.mansions.find((m: any) => m.name === '翼').missingOrdinals.length, 7)
})

test('projection wraps right ascension at zero and preserves north/east orientation', () => {
  const stars = projectAsterism([
    { hip: 1, ra: 359, dec: 0, magnitude: 1 },
    { hip: 2, ra: 1, dec: 0, magnitude: 1 },
    { hip: 3, ra: 0, dec: 1, magnitude: 1 },
  ])
  assert.ok(stars[0].x > stars[1].x, 'east is left')
  assert.ok(stars[2].y < stars[0].y, 'north is up')
  assert.ok(Math.abs(stars[0].x + stars[1].x) < 1e-9)
  const width = stars[0].x - stars[1].x
  const height = stars[0].y - stars[2].y
  assert.ok(Math.abs(width / height - 2) < .01, 'no independent x/y stretching')
})
