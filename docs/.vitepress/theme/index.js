import { h } from 'vue'
import DefaultTheme from 'vitepress/theme'
import { useRoute, useData } from 'vitepress'
import { onMounted, onBeforeUnmount, watch, nextTick, toRefs } from 'vue'
import mediumZoom from 'medium-zoom'
import './custom.css'
import { initRibbon, disposeRibbon } from './ribbon'
import giscusTalk from 'vitepress-plugin-comment-with-giscus'
import {
  NolebaseEnhancedReadabilitiesPlugin,
  NolebaseEnhancedReadabilitiesMenu,
  NolebaseEnhancedReadabilitiesScreenMenu,
  SpotlightStyles,
} from '@nolebase/vitepress-plugin-enhanced-readabilities'
import '@nolebase/vitepress-plugin-enhanced-readabilities/client/style.css'
import 'katex/dist/katex.min.css'
import 'virtual:group-icons.css'

export default {
  ...DefaultTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {
      'nav-bar-content-after': () => h(NolebaseEnhancedReadabilitiesMenu),
      'nav-screen-content-after': () => h(NolebaseEnhancedReadabilitiesScreenMenu),
      'layout-bottom': () => h(SpotlightStyles),
    })
  },
  enhanceApp(ctx) {
    DefaultTheme.enhanceApp(ctx)
    ctx.app.use(NolebaseEnhancedReadabilitiesPlugin)
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
    onMounted(() => initRibbon())
    onBeforeUnmount(disposeRibbon)
    watch(() => route.path, () => nextTick(initZoom))
  },
}