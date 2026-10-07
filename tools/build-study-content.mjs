import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { selectReviewedCards, validateStudyContent } from './check-study-content.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const load = async (path) => JSON.parse(await readFile(join(ROOT, path), 'utf8'))
const [cards, catalog] = await Promise.all([load('content/study-cards.json'), load('content/catalog.json')])
const existingPaths = new Set()
for (const item of catalog.contents ?? []) {
  try { await access(join(ROOT, item.localPath)); existingPaths.add(item.localPath) } catch { /* validator reports it */ }
}
validateStudyContent({ cards, catalog, existingPaths })

const output = selectReviewedCards(cards, catalog)
const outputPath = join(ROOT, 'docs', 'public', 'study-cards.json')
await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8')
console.log(`[study-content] 生成 ${output.length} 张已核对卡片 → docs/public/study-cards.json`)
