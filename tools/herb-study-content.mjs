import { createHash } from 'node:crypto'

const textFields = ['name', 'chapter', 'subsection', 'suji', 'xingwei', 'guijing', 'url']
const listFields = ['gongxiao', 'zhuzhi']
const digest = (value) => createHash('sha256').update(value).digest('hex').slice(0, 12)
export const herbRegistryKey = (card) => `${card.name}\u0000${card.url}`
export const initialHerbId = (card) => `herb-${digest(herbRegistryKey(card))}`

export function validateHerbRegistry(cards, registry) {
  if (!registry || registry.version !== 1 || !Array.isArray(registry.entries)) throw new Error('herb registry 格式无效')
  const byKey = new Map()
  const ids = new Set()
  const cardKeys = new Set()
  for (const entry of registry.entries) {
    if (!entry || typeof entry.name !== 'string' || typeof entry.url !== 'string' || !/^herb-[a-f0-9]{12}$/.test(entry.id)) throw new Error('herb registry 条目无效')
    const key = herbRegistryKey(entry)
    if (byKey.has(key)) throw new Error(`herb registry 重复条目: ${entry.name} ${entry.url}`)
    if (ids.has(entry.id)) throw new Error(`herb registry ID 冲突: ${entry.id}`)
    byKey.set(key, entry.id)
    ids.add(entry.id)
  }
  for (const card of cards) {
    const key = herbRegistryKey(card)
    if (cardKeys.has(key)) throw new Error(`现有药卡重复: ${card.name} ${card.url}`)
    cardKeys.add(key)
    if (!byKey.has(key)) throw new Error(`herb registry 缺少 ID: ${card.name} ${card.url}`)
  }
  if (byKey.size !== cardKeys.size) throw new Error('herb registry 含有已不存在的药卡条目')
  return byKey
}

export function createInitialHerbRegistry(cards) {
  return {
    version: 1,
    entries: cards.map((card) => ({ name: card.name, url: card.url, id: initialHerbId(card) }))
      .sort((a, b) => a.url.localeCompare(b.url, 'zh')),
  }
}

export function createHerbStudyCards(cards, registry) {
  const ids = validateHerbRegistry(cards, registry)
  return cards.map((card) => {
    for (const field of textFields) if (typeof card[field] !== 'string') throw new Error(`${card.name || '未知药卡'} 缺少字段 ${field}`)
    for (const field of listFields) if (!Array.isArray(card[field]) || card[field].some((value) => typeof value !== 'string')) throw new Error(`${card.name} 字段 ${field} 格式无效`)
    const id = ids.get(herbRegistryKey(card))
    return {
      id,
      contentId: `herb-note-${id.slice(5)}`,
      categoryId: `herb-category-${digest(card.chapter)}`,
      category: card.chapter,
      question: card.name,
      answer: card.suji,
      sourceUrl: card.url,
      sourceTitle: `现有药卡笔记 · ${card.name}`,
      noteUrl: card.url,
      status: 'unverified',
      kind: 'herb',
      herb: {
        name: card.name,
        chapter: card.chapter,
        subsection: card.subsection,
        suji: card.suji,
        xingwei: card.xingwei,
        guijing: card.guijing,
        gongxiao: [...card.gongxiao],
        zhuzhi: [...card.zhuzhi],
      },
    }
  }).sort((a, b) => a.noteUrl.localeCompare(b.noteUrl, 'zh'))
}
