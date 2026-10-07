import { readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { collectHerbCards } from './gen_flashcards.mjs'
import { createHerbStudyCards } from './herb-study-content.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const STUDY_CARD_FIELDS = ['id', 'contentId', 'categoryId', 'category', 'question', 'answer', 'sourceUrl', 'sourceTitle', 'noteUrl', 'status']

const nonBlank = (value) => typeof value === 'string' && value.trim().length > 0
const invariant = (condition, message) => { if (!condition) throw new Error(message) }
const routeForLocalPath = (localPath) => `/${localPath.replace(/^docs[\\/]/, '').replace(/\\/g, '/').replace(/\.md$/, '')}`

function assertHttpUrl(value, message) {
  try {
    const url = new URL(value)
    invariant(['http:', 'https:'].includes(url.protocol), message)
  } catch {
    throw new Error(message)
  }
}

export function validateStudyContent({ cards, catalog, existingPaths }) {
  invariant(Array.isArray(cards), '源卡片必须是数组')
  invariant(catalog && Array.isArray(catalog.contents) && Array.isArray(catalog.sources), 'catalog 结构无效')
  invariant(existingPaths instanceof Set, 'existingPaths 必须是 Set')

  const sources = new Map()
  for (const source of catalog.sources) {
    invariant(nonBlank(source.id) && !sources.has(source.id), `来源 id 重复或为空: ${source.id ?? ''}`)
    for (const key of ['sourceTitle', 'sourceUrl', 'accessedAt', 'license', 'licenseEvidence', 'licenseEvidenceUrl']) invariant(nonBlank(source[key]), `来源 ${source.id} 缺少 ${key}`)
    assertHttpUrl(source.sourceUrl, `来源 ${source.id} 的 sourceUrl 无效`)
    assertHttpUrl(source.licenseEvidenceUrl, `来源 ${source.id} 的 licenseEvidenceUrl 无效`)
    sources.set(source.id, source)
  }

  const contents = new Map()
  for (const item of catalog.contents) {
    invariant(nonBlank(item.contentId) && !contents.has(item.contentId), `contentId 重复或为空: ${item.contentId ?? ''}`)
    invariant(['reviewed', 'draft'].includes(item.status), `内容状态无效: ${item.contentId}`)
    invariant(sources.has(item.sourceId), `内容来源不存在: ${item.contentId}`)
    invariant(nonBlank(item.localPath), `内容缺少 localPath: ${item.contentId}`)
    if (item.status === 'reviewed') invariant(existingPaths.has(item.localPath), `已核对内容的本地文件不存在: ${item.localPath}`)
    contents.set(item.contentId, item)
  }

  const ids = new Set()
  const categoryNames = new Map()
  for (const [index, card] of cards.entries()) {
    invariant(card && typeof card === 'object' && !Array.isArray(card), `card[${index}] 不是对象`)
    invariant(JSON.stringify(Object.keys(card).sort()) === JSON.stringify([...STUDY_CARD_FIELDS].sort()), `card[${index}] 字段不符合 StudyCard 源格式`)
    for (const field of STUDY_CARD_FIELDS) invariant(nonBlank(card[field]), `card[${index}].${field} 为空`)
    invariant(['reviewed', 'draft'].includes(card.status), `card[${index}] 状态无效`)
    invariant(!ids.has(card.id), `重复卡片 id: ${card.id}`)
    ids.add(card.id)

    const previousCategory = categoryNames.get(card.categoryId)
    invariant(!previousCategory || previousCategory === card.category, `categoryId ${card.categoryId} 对应了多个名称`)
    categoryNames.set(card.categoryId, card.category)

    const content = contents.get(card.contentId)
    invariant(content, `卡片引用不存在的 contentId: ${card.id}`)
    if (card.status === 'reviewed') invariant(content.status === 'reviewed', `已核对卡片引用草稿内容: ${card.id}`)
    const source = sources.get(content.sourceId)
    invariant(card.sourceUrl === source.sourceUrl, `卡片来源 URL 与 catalog 不一致: ${card.id}`)
    invariant(card.sourceTitle === source.sourceTitle, `卡片来源标题与 catalog 不一致: ${card.id}`)
    assertHttpUrl(card.sourceUrl, `来源 URL 无效: ${card.id}`)

    const noteRoute = card.noteUrl.split('#', 1)[0]
    invariant(noteRoute === routeForLocalPath(content.localPath), `noteUrl 与 localPath 不一致: ${card.id}`)
    invariant(existingPaths.has(content.localPath), `卡片对应的本地文件不存在: ${card.id}`)
  }
  return { cardCount: cards.length, categoryCount: categoryNames.size, contentCount: contents.size }
}

export function selectReviewedCards(cards, catalog) {
  const reviewedContentIds = new Set(catalog.contents.filter((item) => item.status === 'reviewed').map((item) => item.contentId))
  return cards.filter((card) => card.status === 'reviewed' && reviewedContentIds.has(card.contentId)).sort((a, b) => a.id.localeCompare(b.id, 'en'))
}

async function runCli() {
  const load = async (path) => JSON.parse(await readFile(join(ROOT, path), 'utf8'))
  const registry = await load('content/herb-registry.json')
  const sourceCards = collectHerbCards(ROOT)
  const studyCards = createHerbStudyCards(sourceCards, registry)
  const ids = new Set(studyCards.map((card) => card.id))
  if (ids.size !== studyCards.length) throw new Error('生成的药卡存在重复 ID')
  if (studyCards.some((card) => card.status !== 'unverified')) throw new Error('现有药卡不得被静默标记为已核对')
  console.log(`[study-content] 主药卡校验通过：${sourceCards.length} 张现有药卡，${studyCards.length} 张未统一来源核对的学习卡`)
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : ''
if (invokedPath === import.meta.url) {
  runCli().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
