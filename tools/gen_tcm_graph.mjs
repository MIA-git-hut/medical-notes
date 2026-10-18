// 从 docs/中药学/ 生成知识图谱数据 docs/public/tcm-graph.json
// 节点：药卡、总论、功效分类（文件夹）、归经；边：笔记里的 [[双链]]
// 供 /中药学/图谱 页面（TcmGraph.vue）使用；dev/build 前自动运行
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname, relative, basename, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const NOTES_DIR = join(ROOT, 'docs', '中药学')
const OUT = join(ROOT, 'docs', 'public', 'tcm-graph.json')
const GRAPH_PAGE = '图谱.md'

// 教材章节顺序与配色（暗底上可辨认的 22 色）
const GROUPS = [
  ['解表药', '#67e8f9'],
  ['清热药', '#60a5fa'],
  ['泻下药', '#a78bfa'],
  ['祛风湿药', '#c084fc'],
  ['化湿药', '#e879f9'],
  ['利水渗湿药', '#22d3ee'],
  ['温里药', '#fb923c'],
  ['理气药', '#f472b6'],
  ['消食药', '#fbbf24'],
  ['驱虫药', '#a3e635'],
  ['止血药', '#f87171'],
  ['活血化瘀药', '#fb7185'],
  ['化痰止咳平喘药', '#34d399'],
  ['安神药', '#818cf8'],
  ['平肝息风药', '#2dd4bf'],
  ['开窍药', '#facc15'],
  ['补虚药', '#4ade80'],
  ['收涩药', '#94a3b8'],
  ['涌吐药', '#fca5a5'],
  ['攻毒杀虫止痒药', '#d8b4fe'],
  ['拔毒化腐生肌药', '#fcd34d'],
  ['总论', '#7c8ba1'],
]
const GROUP_INDEX = new Map(GROUPS.map(([name], i) => [name, i]))

const MERIDIAN_ORDER = ['归肺经', '归大肠经', '归胃经', '归脾经', '归心经', '归小肠经', '归膀胱经', '归肾经', '归心包经', '归三焦经', '归胆经', '归肝经']

const FRONT_RE = /^---\s*\n([\s\S]*?)\n---\s*\n/
const H2_RE = /^##\s+(.+?)\s*$/
const WIKI_RE = /\[\[([^\[\]]+)\]\]/g

function readFront(text) {
  const match = FRONT_RE.exec(text)
  const map = {}
  if (!match) return map
  for (const line of match[1].split('\n')) {
    const i = line.indexOf(':')
    if (i > 0) map[line.slice(0, i).trim()] = line.slice(i + 1).trim()
  }
  return map
}

function sections(text) {
  const body = text.replace(FRONT_RE, '')
  const map = new Map()
  let current = null
  let lines = []
  for (const line of body.split('\n')) {
    const match = H2_RE.exec(line.trim())
    if (match) {
      if (current !== null) map.set(current, lines)
      current = match[1].trim()
      lines = []
    } else if (current !== null) {
      lines.push(line)
    }
  }
  if (current !== null) map.set(current, lines)
  return map
}

function pickField(lines = [], key) {
  for (const line of lines) {
    const value = line.trim().replace(/^[-*]\s+/, '')
    if (value.startsWith(key)) {
      const i = value.indexOf('：')
      return (i >= 0 ? value.slice(i + 1) : value.slice(key.length)).trim()
    }
  }
  return ''
}

function bullets(lines = [], limit = 99) {
  const result = []
  for (const line of lines) {
    const match = /^[-*]\s+(.+)$/.exec(line.trim())
    if (match) result.push(match[1].trim())
    if (result.length >= limit) break
  }
  return result
}

function memo(text) {
  const out = []
  let inside = false
  for (const line of text.split('\n')) {
    const value = line.trim()
    if (!inside && /^>\s*\[!info\]\s*速记/i.test(value)) { inside = true; continue }
    if (inside) {
      if (!value.startsWith('>')) break
      const content = value.replace(/^>\s?/, '').trim()
      if (content) out.push(content)
    }
  }
  return out.join('；')
}

const notes = []
const dirs = new Map()

function walk(dir, top) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name.startsWith('.')) continue
      const chapter = top || entry.name
      dirs.set(entry.name, { chapter, top: !top })
      walk(path, chapter)
    } else if (entry.name.endsWith('.md') && entry.name !== 'index.md' && entry.name !== GRAPH_PAGE) {
      const text = readFileSync(path, 'utf8')
      const front = readFront(text)
      const rel = relative(NOTES_DIR, path).split(sep).join('/')
      notes.push({
        id: basename(entry.name, '.md'),
        path,
        url: '/中药学/' + rel.replace(/\.md$/, ''),
        front,
        text,
        chapter: top || '',
      })
    }
  }
}
walk(NOTES_DIR, '')

// 笔记节点
const nodes = []
const byName = new Map()
for (const note of notes) {
  // 总论各章几乎没有双链，孤立节点会把力导向布局撑散；图谱只收药卡
  if (note.chapter === '总论') continue
  const secs = sections(note.text)
  const chapter = note.front['分类'] || note.chapter || '总论'
  const g = GROUP_INDEX.has(chapter) ? GROUP_INDEX.get(chapter) : GROUP_INDEX.get('总论')
  const node = {
    id: note.id,
    t: 'd',
    g,
    u: note.url,
  }
  const xing = pickField(secs.get('性味归经'), '性味')
  const gui = pickField(secs.get('性味归经'), '归经')
  const effect = bullets(secs.get('功效'), 2).join('；')
  const memoText = memo(note.text)
  // 注意：x/y 是 d3-force 的节点坐标，不能拿来存性味等字段
  if (xing) node.sx = xing
  if (gui) node.mer = gui
  if (effect) node.eff = effect
  if (memoText) node.memo = memoText
  if (/内容整理中/.test(note.text)) node.p = 1
  nodes.push(node)
  if (!byName.has(note.id)) byName.set(note.id, node)
}
const noteCount = nodes.length

// 分类节点（只收录被笔记双链引用到的功效分类文件夹）
const linked = new Map()
for (const note of notes) {
  for (const match of note.text.matchAll(WIKI_RE)) {
    const target = match[1].trim()
    if (!target) continue
    if (!linked.has(target)) linked.set(target, [])
    linked.get(target).push(note.id)
  }
}

let categoryCount = 0
for (const [name, info] of dirs) {
  if (!linked.has(name) || byName.has(name)) continue
  const g = GROUP_INDEX.has(info.chapter) ? GROUP_INDEX.get(info.chapter) : GROUP_INDEX.get('总论')
  const node = { id: name, t: 'c', g }
  nodes.push(node)
  byName.set(name, node)
  categoryCount++
}

let meridianCount = 0
for (const name of MERIDIAN_ORDER) {
  if (!linked.has(name)) continue
  const node = { id: name, t: 'm' }
  nodes.push(node)
  byName.set(name, node)
  meridianCount++
}

// 边：[[双链]] → 去重无向边
const edgeMap = new Map()
const indexOf = new Map(nodes.map((node, i) => [node.id, i]))
for (const note of notes) {
  const source = note.id
  for (const match of note.text.matchAll(WIKI_RE)) {
    const target = match[1].trim()
    if (!byName.has(target) || target === source) continue
    const a = indexOf.get(source)
    const b = indexOf.get(target)
    if (a === undefined || b === undefined) continue
    const key = a < b ? `${a},${b}` : `${b},${a}`
    const targetNode = byName.get(target)
    const kind = targetNode.t === 'c' ? 1 : targetNode.t === 'm' ? 2 : 0
    if (!edgeMap.has(key)) edgeMap.set(key, kind)
  }
}
const links = [...edgeMap].map(([key, kind]) => {
  const [a, b] = key.split(',').map(Number)
  return [a, b, kind]
})

// 分组统计
const groups = GROUPS.map(([name, color], index) => ({
  name,
  color,
  count: nodes.filter((node) => node.g === index && (node.t === 'd' || node.t === 'g')).length,
})).filter((group) => group.count > 0)

const output = {
  generatedAt: new Date().toISOString(),
  stats: { notes: noteCount, categories: categoryCount, meridians: meridianCount, links: links.length },
  groups,
  nodes,
  links,
}

writeFileSync(OUT, JSON.stringify(output))
console.log(`[tcm-graph] ${noteCount} 笔记 · ${categoryCount} 分类 · ${meridianCount} 归经 · ${links.length} 关联 → ${relative(ROOT, OUT)}`)
