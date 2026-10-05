// 构建后扫描 dist 生成 sitemap.xml（含中文 URL 转义）
// 排除 404 与带 noindex 的旧地址跳转页；在 vitepress build 之后运行
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = join(ROOT, 'docs', '.vitepress', 'dist')
const SITE_URL = 'https://yixuebiji.top'

function* walkHtml(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) yield* walkHtml(p)
    else if (e.name.endsWith('.html')) yield p
  }
}

const urls = []
for (const file of walkHtml(DIST)) {
  const rel = relative(DIST, file).split(/[\\/]/).join('/')
  if (rel === '404.html') continue
  const html = readFileSync(file, 'utf8')
  if (html.includes('name="robots" content="noindex"')) continue
  let path = rel
  if (path === 'index.html') path = ''
  else if (path.endsWith('/index.html')) path = path.slice(0, -'index.html'.length)
  else path = path.slice(0, -'.html'.length)
  urls.push(path ? `${SITE_URL}/${encodeURI(path)}` : `${SITE_URL}/`)
}

urls.sort()
const xml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...urls.map((u) => `  <url><loc>${u}</loc></url>`),
  '</urlset>',
  '',
].join('\n')

writeFileSync(join(DIST, 'sitemap.xml'), xml)
console.log(`[sitemap] ${urls.length} 条 URL → docs/.vitepress/dist/sitemap.xml`)
