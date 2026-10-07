import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { collectHerbCards } from './gen_flashcards.mjs'
import { createHerbStudyCards } from './herb-study-content.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const registry = JSON.parse(await readFile(join(ROOT, 'content', 'herb-registry.json'), 'utf8'))
const sourceCards = collectHerbCards(ROOT)
const studyCards = createHerbStudyCards(sourceCards, registry)
const outputPath = join(ROOT, 'docs', 'public', 'study-cards.json')

await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify(studyCards, null, 2)}\n`, 'utf8')
console.log(`[study-content] 由 ${sourceCards.length} 张现有药卡生成 ${studyCards.length} 张未统一来源核对的学习卡 → docs/public/study-cards.json`)
