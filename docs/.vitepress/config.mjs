import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'
import { groupIconMdPlugin, groupIconVitePlugin } from 'vitepress-plugin-group-icons'
import { katex } from '@mdit/plugin-katex'
import { readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// 以配置文件自身位置为基准定位 docs 目录，兼容本地与服务器环境
const docsDir = join(dirname(fileURLToPath(import.meta.url)), '..')

// 自动扫描科目文件夹里的 .md 文件生成侧边栏，新建笔记后无需改这里
function autoSidebar(dir, label) {
  let files = []
  try {
    files = readdirSync(join(docsDir, dir)).filter((f) => f.endsWith('.md'))
  } catch {
    // 文件夹为空时不会被 git 同步到服务器，忽略即可
  }
  const items = files.map((f) => ({
    text: f.replace(/\.md$/, ''),
    link: `/${dir}/${f.replace(/\.md$/, '')}`,
  }))
  return [{ text: label, collapsed: false, items }]
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
    plugins: [groupIconVitePlugin()],
  },

  mermaid: {
    theme: 'neutral',
  },

  themeConfig: {
    nav: [
      { text: '首页', link: '/' },

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

    search: { provider: 'local' },
    outline: { level: [2, 3], label: '本页目录' },
    docFooter: { prev: '上一篇', next: '下一篇' },
    lastUpdated: { text: '最后更新' },
    darkModeSwitchLabel: '外观',
    sidebarMenuLabel: '目录',
    returnToTopLabel: '回到顶部',
    langMenuLabel: '语言',
  },
})
