import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { resolveMansionReadings, type MansionNavigationCatalog } from '../shared/mansion-navigation'

const catalog: MansionNavigationCatalog = JSON.parse(fs.readFileSync(new URL('../content/mansion-navigation.json', import.meta.url), 'utf8'))
const names = ['角','亢','氐','房','心','尾','箕','斗','牛','女','虚','危','室','壁','奎','娄','胃','昴','毕','觜','参','井','鬼','柳','星','张','翼','轸']

test('all 28 navigation mappings refer to real local reading destinations', () => {
  assert.equal(catalog.relation, 'editorial-navigation')
  assert.deepEqual(catalog.mansions.map(m => m.name), names)
  assert.equal(new Set(catalog.resources.map(r => r.id)).size, catalog.resources.length)
  for (const mansion of catalog.mansions) {
    const readings = resolveMansionReadings(catalog, mansion.name)
    assert.equal(readings.length, mansion.resourceIds.length, `${mansion.name}: dangling resource ID`)
    for (const reading of readings) {
      assert.match(reading.href, /^\/(?!\/)/)
      assert.ok(!reading.href.includes('..'))
      const pathname = reading.href.split('#')[0]
      const file = pathname.endsWith('/') ? `${pathname}index.md` : `${pathname}.md`
      assert.ok(fs.existsSync(path.join(process.cwd(), 'docs', file)), `${reading.href}: missing local page`)
    }
  }
})

test('a mansion can configure multiple readings independently, or have none', () => {
  const configured = structuredClone(catalog)
  configured.mansions[0].resourceIds = [catalog.resources[1].id, catalog.resources[3].id]
  assert.deepEqual(resolveMansionReadings(configured, '角').map(r => r.id), configured.mansions[0].resourceIds)
  assert.deepEqual(resolveMansionReadings(configured, '亢').map(r => r.id), catalog.mansions[1].resourceIds)
  configured.mansions[0].resourceIds = []
  assert.deepEqual(resolveMansionReadings(configured, '角'), [])
  assert.deepEqual(resolveMansionReadings(configured, '不存在'), [])
})
