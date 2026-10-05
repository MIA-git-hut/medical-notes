// Obsidian 双链 [[名称]] 渲染插件
// 名称命中 docs 下已存在的非空页面（药卡、归经索引页等）→ 站内链接；
// 未命中（功效分类等空心节点）→ 静音标签，避免方括号原样显示
import { readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

function collectPageLinks(docsDir) {
  const map = {}
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name)
      if (e.isDirectory()) {
        if (!e.name.startsWith('.') && e.name !== 'public') walk(p)
      } else if (e.name.endsWith('.md') && e.name !== 'index.md' && statSync(p).size > 0) {
        const name = e.name.slice(0, -3)
        if (!(name in map)) {
          map[name] = '/' + relative(docsDir, p).split(sep).join('/').slice(0, -3)
        }
      }
    }
  }
  walk(docsDir)
  return map
}

const escapeHtml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function wikiLinkPlugin(docsDir) {
  const links = collectPageLinks(docsDir)
  return (md) => {
    md.inline.ruler.before('link', 'wikilink', (state, silent) => {
      const pos = state.pos
      if (state.src.charCodeAt(pos) !== 0x5b || state.src.charCodeAt(pos + 1) !== 0x5b) return false
      const end = state.src.indexOf(']]', pos + 2)
      if (end === -1) return false
      const label = state.src.slice(pos + 2, end).trim()
      if (!label || label.includes('[') || label.includes(']')) return false
      if (!silent) {
        const url = links[label]
        const token = state.push('html_inline', '', 0)
        const safe = escapeHtml(label)
        token.content = url
          ? `<a class="sby-wikilink" href="${url}">${safe}</a>`
          : `<span class="sby-wikilink-muted">${safe}</span>`
      }
      state.pos = end + 2
      return true
    })
  }
}
