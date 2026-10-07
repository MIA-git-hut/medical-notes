import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it } from 'node:test'
// @ts-expect-error Build tools intentionally remain dependency-free ESM.
import { collectHerbCards } from '../tools/gen_flashcards.mjs'
// @ts-expect-error Build tools intentionally remain dependency-free ESM.
import { createHerbStudyCards, validateHerbRegistry } from '../tools/herb-study-content.mjs'

interface ExistingHerbCard {
  name: string
  chapter: string
  subsection: string
  suji: string
  xingwei: string
  guijing: string
  gongxiao: string[]
  zhuzhi: string[]
  url: string
}

const root = resolve(import.meta.dirname, '..')
const sourceCards = collectHerbCards(root) as ExistingHerbCard[]
const registry = JSON.parse(readFileSync(resolve(root, 'content/herb-registry.json'), 'utf8'))

describe('existing herb notes study pipeline', () => {
  it('creates exactly one unverified study card for every non-placeholder existing herb card', () => {
    const cards = createHerbStudyCards(sourceCards, registry)
    assert.ok(sourceCards.length > 0)
    assert.equal(cards.length, sourceCards.length)
    assert.equal(new Set(cards.map((card: { id: string }) => card.id)).size, cards.length)
    assert.ok(cards.every((card: { status: string; kind: string }) => card.status === 'unverified' && card.kind === 'herb'))
  })

  it('copies every medical content field exactly without authoring new facts', () => {
    const cards = createHerbStudyCards(sourceCards, registry)
    const sourceByUrl = new Map<string, ExistingHerbCard>(sourceCards.map(card => [card.url, card]))
    for (const card of cards) {
      const source = sourceByUrl.get(card.sourceUrl)
      assert.ok(source, `missing source for ${card.id}`)
      assert.equal(card.question, source.name)
      assert.equal(card.answer, source.suji)
      assert.equal(card.noteUrl, source.url)
      assert.equal(card.sourceTitle, `现有药卡笔记 · ${source.name}`)
      assert.equal(card.category, source.chapter)
      assert.deepEqual(card.herb, {
        name: source.name,
        chapter: source.chapter,
        subsection: source.subsection,
        suji: source.suji,
        xingwei: source.xingwei,
        guijing: source.guijing,
        gongxiao: source.gongxiao,
        zhuzhi: source.zhuzhi,
      })
    }
  })

  it('uses the persisted registry for stable IDs regardless of source order', () => {
    const forward = createHerbStudyCards(sourceCards, registry).map((card: { id: string }) => card.id)
    const reversed = createHerbStudyCards([...sourceCards].reverse(), registry).map((card: { id: string }) => card.id)
    assert.deepEqual(reversed, forward)
  })

  it('fails loudly for missing IDs and ID collisions', () => {
    const missing = { ...registry, entries: registry.entries.slice(1) }
    assert.throws(() => validateHerbRegistry(sourceCards, missing), /缺少 ID/)

    const collision = structuredClone(registry)
    collision.entries[1].id = collision.entries[0].id
    assert.throws(() => validateHerbRegistry(sourceCards, collision), /ID 冲突/)
  })
})
