import { defineConfig } from 'vitepress'

export default defineConfig({
  lang: 'zh-CN',
  title: '我的医学笔记',
  description: '个人医学学习笔记网站',
  lastUpdated: true,

  themeConfig: {
    nav: [
      { text: '首页', link: '/' },
      { text: '解剖学', link: '/解剖学/颅骨' },
      { text: '生理学', link: '/生理学/心肌细胞跨膜电位' },
      { text: '使用指南', link: '/使用指南' },
    ],

    sidebar: {
      // 解剖学板块的左侧目录。新建笔记后，在这里加一行即可
      '/解剖学/': [
        {
          text: '解剖学',
          collapsed: false,
          items: [
            { text: '颅骨', link: '/解剖学/颅骨' },
          ],
        },
      ],
      // 生理学板块的左侧目录
      '/生理学/': [
        {
          text: '生理学',
          collapsed: false,
          items: [
            { text: '内环境与稳态', link: '/生理学/内环境稳态' },
            { text: '心肌细胞的跨膜电位', link: '/生理学/心肌细胞跨膜电位' },
          ],
        },
      ],
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
