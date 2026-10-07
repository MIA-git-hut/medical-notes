import { defineConfig } from 'vitepress'
import { groupIconMdPlugin, groupIconVitePlugin } from 'vitepress-plugin-group-icons'
import { pagefindPlugin } from 'vitepress-plugin-pagefind'
import { existsSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { wikiLinkPlugin } from './wiki-link.mjs'

// 以配置文件自身位置为基准定位 docs 目录，兼容本地与服务器环境
const docsDir = join(dirname(fileURLToPath(import.meta.url)), '..')

const SITE_URL = 'https://yixuebiji.top'

// 药味迁册（对齐十五五教材）后失效的旧地址。
// 不用 vercel.json 的 redirects：Vercel 匹配不了含中文的 source，线上实测 404，
// 改为构建时在 dist 里生成跳转页，随构建产物一起生效
const PAGE_REDIRECTS = [
  ['中药学/清热药/清热泻火药/谷精草', '中药学/解表药/发散风热药/谷精草'],
  ['中药学/止血药/化瘀止血药/降香', '中药学/活血化瘀药/活血止痛药/降香'],
]

function redirectPage(url) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="robots" content="noindex">
<meta http-equiv="refresh" content="0; url=${url}">
<link rel="canonical" href="${url}">
<title>页面已迁移</title>
</head>
<body data-pagefind-ignore="all" style="margin:0;background:#0a0c14;color:#8b90a8;font-family:system-ui,sans-serif">
<div style="min-height:100vh;display:flex;align-items:center;justify-content:center">
<p>这味药已迁到新分类，正在跳转……若未跳转，<a style="color:#3b82f6" href="${url}">点这里</a></p>
</div>
</body>
</html>
`
}

// 递归扫描文件夹生成树形侧边栏，支持「科目/分类/笔记」多层结构
function scanDir(rel) {
  let entries = []
  try {
    entries = readdirSync(join(docsDir, rel), { withFileTypes: true })
  } catch {
    // 文件夹不存在或为空时忽略
    return []
  }
  const items = []
  for (const e of entries.sort((a, b) => {
    if (a.name === '总论') return -1
    if (b.name === '总论') return 1
    return a.name.localeCompare(b.name, 'zh')
  })) {
    if (e.name.endsWith('.md') && e.name !== 'index.md') {
      const base = e.name.replace(/\.md$/, '')
      // 数字前缀（如 1-中药的起源…）只用于排序，显示时剥离
      items.push({
        text: base.replace(/^\d+[-.]/, ''),
        link: `/${rel}/${base}`,
      })
    } else if (e.isDirectory() && !e.name.startsWith('.')) {
      const children = scanDir(`${rel}/${e.name}`)
      if (children.length > 0) {
        items.push({ text: e.name, collapsed: false, items: children })
      } else if (existsSync(join(docsDir, rel, e.name, 'index.md'))) {
        // 目录里只有 index.md 时，作为单页入口（如 四大经典/伤寒论/）
        items.push({ text: e.name, link: `/${rel}/${e.name}/` })
      }
    }
  }
  return items
}

// 自动生成科目侧边栏，新建笔记后无需改这里
function autoSidebar(dir, label) {
  return [{ text: label, collapsed: false, items: scanDir(dir) }]
}

export default defineConfig({
  appearance: true,
  lang: 'zh-CN',
  title: '溯本医源',
  description: '中医知识整理与检索 · 溯源古籍原文',
  lastUpdated: true,

  head: [['meta', { name: 'theme-color', content: '#0a0c14' }]],

  // 每页注入 OG / canonical——分享到微信、小红书时显示标题、描述与预览图
  transformHead({ pageData }) {
    const rel = pageData.relativePath
    let clean = rel
    if (clean === 'index.md') clean = ''
    else if (clean.endsWith('/index.md')) clean = clean.slice(0, -'index.md'.length)
    else clean = clean.replace(/\.md$/, '')
    const url = clean ? `${SITE_URL}/${encodeURI(clean)}` : `${SITE_URL}/`
    const isHome = clean === ''
    const pageTitle = pageData.frontmatter.title || pageData.title || ''
    const ogTitle = isHome || !pageTitle ? '溯本医源 · 中医知识整理与检索' : `${pageTitle} | 溯本医源`
    const desc =
      pageData.frontmatter.description ||
      (isHome || !pageTitle
        ? '中医知识整理与检索 · 溯源古籍原文'
        : `「${pageTitle}」——中医知识整理与检索 · 溯本医源`)
    return [
      ['meta', { property: 'og:type', content: isHome ? 'website' : 'article' }],
      ['meta', { property: 'og:site_name', content: '溯本医源' }],
      ['meta', { property: 'og:title', content: ogTitle }],
      ['meta', { property: 'og:description', content: desc }],
      ['meta', { property: 'og:url', content: url }],
      ['meta', { property: 'og:image', content: `${SITE_URL}/og.png` }],
      ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
      ['link', { rel: 'canonical', href: url }],
    ]
  },

  // 生成旧地址的跳转页（dist 里同时留 .html 与 目录/index.html 两种形式）
  buildEnd(siteConfig) {
    const base = siteConfig.base || '/'
    for (const [from, to] of PAGE_REDIRECTS) {
      const html = redirectPage(base + to)
      for (const rel of [`${from}.html`, `${from}/index.html`]) {
        const file = join(siteConfig.outDir, rel)
        mkdirSync(dirname(file), { recursive: true })
        writeFileSync(file, html)
      }
    }
  },
  markdown: {
    config(md) {
      md.use(groupIconMdPlugin)
      md.use(wikiLinkPlugin(docsDir))
    },
  },

  vite: {
    plugins: [
      groupIconVitePlugin(),
      pagefindPlugin({
        btnPlaceholder: '搜索',
        placeholder: '搜索全站笔记',
        emptyText: '空空如也，换个关键词试试',
        heading: '共 {{searchResult}} 条结果',
        toSelect: '选择',
        toNavigate: '切换',
        toClose: '关闭',
        searchBy: '由 Pagefind 驱动',
        // 查询原样交给 pagefind（不分词）：索引端 Rust ICU 与浏览器 Intl.Segmenter
        // 的分词结果不一致（会把「黄芪」切成「黄 芪」），必须两侧都不分词才能对齐
        customSearchQuery: (q) => q,
        forceLanguage: 'zh-cn',
      }),
    ],
    ssr: {
      noExternal: ['@nolebase/*'],
    },
  },

  themeConfig: {
    lightModeSwitchTitle: '切换到白天模式',
    darkModeSwitchTitle: '切换到夜间模式',
    nav: [
      { text: '首页', link: '/' },
      { text: '中药学', link: '/中药学/' },
      {
        text: '四大经典',
        items: [
          { text: '黄帝内经', link: '/四大经典/黄帝内经/' },
          { text: '伤寒论', link: '/四大经典/伤寒论/' },
          { text: '金匮要略', link: '/四大经典/金匮要略/' },
          { text: '神农本草经', link: '/四大经典/神农本草经/' },
        ],
      },
      { text: '自测', link: '/自测/' },
    ],

    sidebar: {
      // 自动读取各科目文件夹里的 .md 文件生成目录，新建笔记后无需改这里
      '/中药学/': autoSidebar('中药学', '中药学'),
      '/四大经典/': autoSidebar('四大经典', '四大经典'),
    },

    outline: { level: [2, 3], label: '本页目录' },
    docFooter: { prev: '上一篇', next: '下一篇' },
    lastUpdated: { text: '最后更新' },
    darkModeSwitchLabel: '外观',
    sidebarMenuLabel: '目录',
    returnToTopLabel: '回到顶部',
    langMenuLabel: '语言',
  },
})
