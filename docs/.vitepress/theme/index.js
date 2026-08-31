import DefaultTheme from 'vitepress/theme'
import { useRoute, useData } from 'vitepress'
import { onMounted, watch, nextTick, toRefs } from 'vue'
import mediumZoom from 'medium-zoom'
import giscusTalk from 'vitepress-plugin-comment-with-giscus'
import 'katex/dist/katex.min.css'
import 'virtual:group-icons.css'

export default {
  ...DefaultTheme,
  enhanceApp(ctx) {
    DefaultTheme.enhanceApp(ctx)
  },
  setup() {
    const { frontmatter } = toRefs(useData())
    const route = useRoute()

    giscusTalk({
      repo: 'MIA-git-hut/medical-notes',
      repoId: 'R_kgDOTxCVIw',
      category: 'General',
      categoryId: 'DIC_kwDOTxCVI84DEko1',
      mapping: 'pathname',
      inputPosition: 'top',
      lang: 'zh-CN',
      homePageShowComment: false,
      lightTheme: 'light',
      darkTheme: 'transparent_dark',
    }, { frontmatter, route }, true)

    const initZoom = () => {
      mediumZoom('.main img', { background: 'var(--vp-c-bg)', margin: 24 })
    }
    onMounted(initZoom)
    watch(() => route.path, () => nextTick(initZoom))
  },
}