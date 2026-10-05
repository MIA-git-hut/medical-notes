// 从 docs/中药学/ 药卡生成闪卡数据 docs/public/flashcards.json
// 供 /自测/ 页面（Flashcard.vue）使用；构建与 dev 前自动运行
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const NOTES_DIR = join(ROOT, 'docs', '中药学')
const OUT = join(ROOT, 'docs', 'public', 'flashcards.json')

const FRONT_RE = /^---\s*\n([\s\S]*?)\n---\s*\n/
const H1_RE = /^#\s+.+$/m
const H2_RE = /^##\s+(.+?)\s*$/

function* walkMd(dir) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const e of entries.sort((a, b) => a.name.localeCompare(b.name, 'zh'))) {
    const p = join(dir, e.name)
    if (e.isDirectory()) {
      if (!e.name.startsWith('.')) yield* walkMd(p)
    } else if (e.name.endsWith('.md') && e.name !== 'index.md') {
      yield p
    }
  }
}

function parseSections(text) {
  const body = text.replace(FRONT_RE, '').replace(H1_RE, '')
  const sections = new Map()
  let cur = null
  let buf = []
  for (const line of body.split('\n')) {
    const m = H2_RE.exec(line.trim())
    if (m) {
      if (cur !== null) sections.set(cur, buf)
      cur = m[1].trim()
      buf = []
    } else if (cur !== null) {
      buf.push(line)
    }
  }
  if (cur !== null) sections.set(cur, buf)
  return sections
}

function bullets(lines = []) {
  const out = []
  for (const raw of lines) {
    const m = /^[-*]\s+(.+)$/.exec(raw.trim())
    if (m) out.push(m[1].trim())
  }
  return out
}

// 提取 > [!label] callout 块（跳过标签行，遇非引用行结束）
function extractCallout(text, label) {
  const out = []
  let inBlock = false
  const startRe = new RegExp('^>\\s*\\[!' + label + '\\]', 'i')
  for (const ln of text.split('\n')) {
    const s = ln.trim()
    if (!inBlock && startRe.test(s)) {
      inBlock = true
      continue
    }
    if (inBlock) {
      if (s.startsWith('>')) {
        const c = s.replace(/^>\s?/, '').trim()
        if (c) out.push(c)
      } else {
        break
      }
    }
  }
  return out.join('；')
}

// 「性味：xxx」「- 归经：yyy」两种写法都兼容
function pickField(lines = [], key) {
  for (const ln of lines) {
    const s = ln.trim().replace(/^[-*]\s+/, '')
    if (s.startsWith(key)) {
      const i = s.indexOf('：')
      return i >= 0 ? s.slice(i + 1).trim() : s.slice(key.length).trim()
    }
  }
  return ''
}

const cards = []
let skipped = 0

for (const file of walkMd(NOTES_DIR)) {
  const text = readFileSync(file, 'utf8')
  const rel = relative(NOTES_DIR, file).split(/[\\/]/)
  const name = rel[rel.length - 1].replace(/\.md$/, '')
  // 完整卡以「速记」callout 为准；附药占位卡（无速记）跳过
  const suji = extractCallout(text, 'info')
  if (!suji) {
    skipped++
    continue
  }
  const sections = parseSections(text)
  cards.push({
    name,
    chapter: rel[0],
    subsection: rel.length >= 3 ? rel[1] : '',
    suji,
    xingwei: pickField(sections.get('性味归经'), '性味'),
    guijing: pickField(sections.get('性味归经'), '归经'),
    gongxiao: bullets(sections.get('功效')),
    zhuzhi: bullets(sections.get('主治')),
    url: '/中药学/' + rel.slice(0, -1).join('/') + '/' + name,
  })
}

writeFileSync(OUT, JSON.stringify(cards))
const kb = (Buffer.byteLength(JSON.stringify(cards)) / 1024).toFixed(0)
console.log(`[flashcards] 生成 ${cards.length} 张闪卡（跳过占位卡 ${skipped} 张）→ ${relative(ROOT, OUT).replace(/\\/g, '/')}（${kb} KB）`)
