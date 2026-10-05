import { h } from 'vue'
import DefaultTheme from 'vitepress/theme'
import { useRoute, useData } from 'vitepress'
import { onMounted, onBeforeUnmount, watch, nextTick, toRefs } from 'vue'
import mediumZoom from 'medium-zoom'
import './custom.css'
import HomeContent from './HomeContent.vue'
import Flashcard from './Flashcard.vue'
import { initConstellation, disposeConstellation } from './constellation'
import { installPagefindShim } from './pagefind-shim'
import giscusTalk from 'vitepress-plugin-comment-with-giscus'
import {
  NolebaseEnhancedReadabilitiesPlugin,
  NolebaseEnhancedReadabilitiesMenu,
  NolebaseEnhancedReadabilitiesScreenMenu,
  SpotlightStyles,
} from '@nolebase/vitepress-plugin-enhanced-readabilities'
import '@nolebase/vitepress-plugin-enhanced-readabilities/client/style.css'
import 'virtual:group-icons.css'

installPagefindShim()

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
    ctx.app.component('HomeContent', HomeContent)
    ctx.app.component('Flashcard', Flashcard)
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
    // 星座背景只在首页运行，其余页面留静态渐变底（避免全站每页常驻 canvas 动画）
    const syncConstellation = () => {
      if (route.path === '/') initConstellation()
      else disposeConstellation()
    }
    onMounted(syncConstellation)
    onBeforeUnmount(disposeConstellation)
    watch(() => route.path, () => {
      nextTick(initZoom)
      syncConstellation()
    })
  },
}