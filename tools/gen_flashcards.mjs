// 从 docs/中药学/ 药卡生成闪卡数据 docs/public/flashcards.json
// 供 /自测/ 页面（Flashcard.vue）使用；构建与 dev 前自动运行
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'docs', 'public', 'flashcards.json')
const FRONT_RE = /^---\s*\n([\s\S]*?)\n---\s*\n/
const H1_RE = /^#\s+.+$/m
const H2_RE = /^##\s+(.+?)\s*$/

function* walkMd(dir) {
  let entries
  try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return }
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name, 'zh'))) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (!entry.name.startsWith('.')) yield* walkMd(path)
    } else if (entry.name.endsWith('.md') && entry.name !== 'index.md') yield path
  }
}

function parseSections(text) {
  const body = text.replace(FRONT_RE, '').replace(H1_RE, '')
  const sections = new Map()
  let current = null
  let lines = []
  for (const line of body.split('\n')) {
    const match = H2_RE.exec(line.trim())
    if (match) {
      if (current !== null) sections.set(current, lines)
      current = match[1].trim()
      lines = []
    } else if (current !== null) lines.push(line)
  }
  if (current !== null) sections.set(current, lines)
  return sections
}

function bullets(lines = []) {
  const result = []
  for (const raw of lines) {
    const match = /^[-*]\s+(.+)$/.exec(raw.trim())
    if (match) result.push(match[1].trim())
  }
  return result
}

function extractCallout(text, label) {
  const result = []
  let inBlock = false
  const start = new RegExp(`^>\\s*\\[!${label}\\]`, 'i')
  for (const line of text.split('\n')) {
    const value = line.trim()
    if (!inBlock && start.test(value)) { inBlock = true; continue }
    if (inBlock) {
      if (!value.startsWith('>')) break
      const content = value.replace(/^>\s?/, '').trim()
      if (content) result.push(content)
    }
  }
  return result.join('；')
}

function pickField(lines = [], key) {
  for (const line of lines) {
    const value = line.trim().replace(/^[-*]\s+/, '')
    if (value.startsWith(key)) {
      const separator = value.indexOf('：')
      return separator >= 0 ? value.slice(separator + 1).trim() : value.slice(key.length).trim()
    }
  }
  return ''
}

function collect(root) {
  const notesDir = join(root, 'docs', '中药学')
  const cards = []
  let skipped = 0
  for (const file of walkMd(notesDir)) {
    const text = readFileSync(file, 'utf8')
    const parts = relative(notesDir, file).split(/[\\/]/)
    const name = parts.at(-1).replace(/\.md$/, '')
    const suji = extractCallout(text, 'info')
    if (!suji) { skipped++; continue }
    const sections = parseSections(text)
    cards.push({
      name,
      chapter: parts[0],
      subsection: parts.length >= 3 ? parts[1] : '',
      suji,
      xingwei: pickField(sections.get('性味归经'), '性味'),
      guijing: pickField(sections.get('性味归经'), '归经'),
      gongxiao: bullets(sections.get('功效')),
      zhuzhi: bullets(sections.get('主治')),
      url: `/中药学/${parts.slice(0, -1).join('/')}/${name}`,
    })
  }
  return { cards, skipped }
}

/** Pure collection entry used by both legacy browsing and the study-card builder. */
export function collectHerbCards(root = ROOT) {
  return collect(resolve(root)).cards
}

function runCli() {
  const { cards, skipped } = collect(ROOT)
  const json = JSON.stringify(cards)
  writeFileSync(OUT, json)
  const kb = (Buffer.byteLength(json) / 1024).toFixed(0)
  console.log(`[flashcards] 生成 ${cards.length} 张闪卡（跳过占位卡 ${skipped} 张）→ ${relative(ROOT, OUT).replace(/\\/g, '/')}（${kb} KB）`)
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : ''
if (invokedPath === import.meta.url) runCli()
