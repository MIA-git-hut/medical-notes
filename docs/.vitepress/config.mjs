import { defineConfig } from 'vitepress'
import { readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// 以配置文件自身位置为基准定位 docs 目录，兼容本地与服务器环境
const docsDir = join(dirname(fileURLToPath(import.meta.url)), '..')

// 自动扫描科目文件夹里的 .md 文件生成侧边栏，新建笔记后无需改这里
function autoSidebar(dir, label) {
  const files = readdirSync(join(docsDir, dir)).filter((f) => f.endsWith('.md'))
  const items = files.map((f) => ({
    text: f.replace(/\.md$/, ''),
    link: `/${dir}/${f.replace(/\.md$/, '')}`,
  }))
  return [{ text: label, collapsed: false, items }]
}

export default defineConfig({
  lang: 'zh-CN',
  title: '我的医学笔记',
  description: '个人医学学习笔记网站',
  lastUpdated: true,

  themeConfig: {
    nav: [
      { text: '首页', link: '/' },
      { text: '生理学', link: '/生理学/心肌细胞跨膜电位' },
      { text: '公众号', link: '/公众号/秋，肺当时令' },
      { text: '使用指南', link: '/使用指南' },
    ],

    sidebar: {
      // 自动读取各科目文件夹里的 .md 文件生成目录，新建笔记后无需改这里
      '/解剖学/': autoSidebar('解剖学', '解剖学'),
      '/生理学/': autoSidebar('生理学', '生理学'),
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
