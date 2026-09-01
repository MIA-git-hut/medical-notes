import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'
import { groupIconMdPlugin, groupIconVitePlugin } from 'vitepress-plugin-group-icons'
import { pagefindPlugin, chineseSearchOptimize } from 'vitepress-plugin-pagefind'
import { katex } from '@mdit/plugin-katex'
import { readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// 以配置文件自身位置为基准定位 docs 目录，兼容本地与服务器环境
const docsDir = join(dirname(fileURLToPath(import.meta.url)), '..')

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
  for (const e of entries.sort((a, b) => a.name.localeCompare(b.name, 'zh'))) {
    if (e.name.endsWith('.md') && e.name !== 'index.md') {
      items.push({
        text: e.name.replace(/\.md$/, ''),
        link: `/${rel}/${e.name.replace(/\.md$/, '')}`,
      })
    } else if (e.isDirectory() && !e.name.startsWith('.')) {
      const children = scanDir(`${rel}/${e.name}`)
      if (children.length > 0) {
        items.push({ text: e.name, collapsed: false, items: children })
      }
    }
  }
  return items
}

// 自动生成科目侧边栏，新建笔记后无需改这里
function autoSidebar(dir, label) {
  return [{ text: label, collapsed: false, items: scanDir(dir) }]
}

export default withMermaid({
  lang: 'zh-CN',
  title: '溯本医源',
  description: '个人中医学习笔记网站',
  lastUpdated: true,
  markdown: {
    config(md) {
      md.use(katex)
      md.use(groupIconMdPlugin)
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
        customSearchQuery: chineseSearchOptimize,
        forceLanguage: 'zh-cn',
      }),
    ],
    ssr: {
      noExternal: ['@nolebase/*'],
    },
  },

  mermaid: {
    theme: 'neutral',
  },

  themeConfig: {
    nav: [
      { text: '首页', link: '/' },
      { text: '中药学', link: '/中药学/' },

      { text: '公众号', link: '/公众号/秋，肺当时令' },
      { text: '使用指南', link: '/使用指南' },
    ],

    sidebar: {
      // 自动读取各科目文件夹里的 .md 文件生成目录，新建笔记后无需改这里
      '/中药学/': autoSidebar('中药学', '中药学'),
      '/方剂学/': autoSidebar('方剂学', '方剂学'),
      '/推拿学/': autoSidebar('推拿学', '推拿学'),
      '/公众号/': autoSidebar('公众号', '公众号'),
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
