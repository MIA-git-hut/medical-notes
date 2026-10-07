<script setup>
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { useData } from 'vitepress'
import HomeConstellation from './HomeConstellation.vue'
import mansionNavigation from '../../../content/mansion-navigation.json'
import { resolveMansionReadings } from '../../../shared/mansion-navigation'

const { isDark } = useData()
const selectedMansion = ref({ name: '角', quadrant: '东方青龙', index: 0, missingCount: 0 })
const selectedReadings = computed(() => resolveMansionReadings(mansionNavigation, selectedMansion.value.name))
const pulseVersion = ref(0)
const readingSettled = ref(false)
function onOrbitSettled() { readingSettled.value = true; pulseVersion.value++ }
function onOrbitMotionStart() { readingSettled.value = false }

const q = ref('')
const results = ref([])
const open = ref(false)
const loading = ref(false)
const searchBox = ref(null)
let pf = null
let timer = 0
let queryId = 0

async function ensurePagefind() {
  if (!pf) {
    const pagefindPath = '/pagefind/pagefind.js'
    const mod = await import(/* @vite-ignore */ pagefindPath)
    if (typeof mod.init === 'function') await mod.init()
    pf = mod
  }
  return pf
}

async function run(term, requestId) {
  try {
    const p = await ensurePagefind()
    const res = await p.search(term)
    const items = await Promise.all(res.results.slice(0, 8).map((r) => r.data()))
    if (requestId !== queryId) return
    results.value = items.map((d) => ({
      url: d.url.replace(/\.html$/, ''),
      title: (d.meta && d.meta.title) || d.url,
      excerpt: d.excerpt || '',
    }))
  } catch {
    if (requestId === queryId) results.value = []
  } finally {
    if (requestId === queryId) loading.value = false
  }
}

function onInput() {
  open.value = true
  clearTimeout(timer)
  const requestId = ++queryId
  const term = q.value.trim()
  if (!term) {
    results.value = []
    loading.value = false
    return
  }
  loading.value = true
  timer = window.setTimeout(() => run(term, requestId), 150)
}

function onKeydown(e) {
  if (e.key === 'Escape') {
    open.value = false
    e.target.blur()
  } else if (e.key === 'Enter' && results.value.length) {
    window.location.href = results.value[0].url
  }
}

function onClickOutside(e) {
  if (searchBox.value && !searchBox.value.contains(e.target)) open.value = false
}

function onGlobalKey(e) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    const input = searchBox.value && searchBox.value.querySelector('input')
    if (input) input.focus()
  }
}

onMounted(() => {
  document.addEventListener('click', onClickOutside)
  document.addEventListener('keydown', onGlobalKey)
})
onBeforeUnmount(() => {
  queryId++
  clearTimeout(timer)
  document.removeEventListener('click', onClickOutside)
  document.removeEventListener('keydown', onGlobalKey)
})
</script>

<template>
  <div class="home-content">
    <div class="page">
      <header class="site-header">
        <a class="brand" href="/">
          <span class="brand-seal">溯</span>
          <span class="brand-name">溯本医源</span>
        </a>
        <nav class="site-nav">
          <a href="/中药学/">中药学</a>
          <a href="/四大经典/">四大经典</a>
          <a href="/自测/">自测</a>
          <button class="theme-toggle" type="button" :aria-label="isDark ? '切换到白天模式' : '切换到夜间模式'" @click="isDark = !isDark">
            {{ isDark ? '☀' : '☾' }}
          </button>
        </nav>
      </header>

      <main class="celestial-stage">
        <HomeConstellation @update:selected="selectedMansion = $event" @motion-start="onOrbitMotionStart" @settled="onOrbitSettled" />
        <div class="orbit-annotation" aria-hidden="true"><span>二十八宿 · 天球环</span><i></i><span>拖动星环，循天入书</span></div>
        <section class="hero">
          <p class="hero-kicker">个人医学学习整理</p>
          <h1 class="hero-title">溯本医源</h1>
          <p class="hero-quote">正气存内，邪不可干 · 把知识化为正气</p>
          <div class="hero-actions">
            <a class="btn btn-primary" href="/中药学/">开始学习</a>
            <a class="btn btn-ghost" href="/四大经典/">四大经典</a>
            <a class="btn btn-ghost" href="/自测/">药卡自测</a>
          </div>

          <div ref="searchBox" class="home-search">
            <svg class="hs-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <circle cx="11" cy="11" r="7" />
              <path d="M20.5 20.5 16 16" />
            </svg>
            <input
              v-model="q"
              class="hs-input"
              type="search"
              placeholder="搜索药名、功效、经典篇目…"
              autocomplete="off"
              @input="onInput"
              @focus="open = true"
              @keydown="onKeydown"
            />
            <span class="hs-kbd">Ctrl K</span>
            <transition name="hs-fade">
              <div v-if="open && q.trim()" class="hs-panel">
                <p v-if="loading" class="hs-empty">搜索中…</p>
                <template v-else-if="results.length">
                  <a v-for="r in results" :key="r.url" class="hs-item" :href="r.url">
                    <span class="hs-title" v-text="r.title"></span>
                    <span class="hs-excerpt" v-html="r.excerpt"></span>
                  </a>
                </template>
                <p v-else class="hs-empty">没有找到「{{ q.trim() }}」，换个关键词试试</p>
              </div>
            </transition>
          </div>
          <p class="orbit-selection"><span>{{ selectedMansion.quadrant }}</span><b>{{ selectedMansion.name }}宿</b><span class="orbit-count">{{ String(selectedMansion.index + 1).padStart(2, '0') }} / 28</span></p>
          <nav class="mansion-readings" :class="{ settled: readingSettled }" :data-settled="pulseVersion" :aria-label="`${selectedMansion.name}宿阅读入口`">
            <span>点击阅读</span>
            <a v-for="reading in selectedReadings" :key="`${reading.id}-${pulseVersion}`" :href="reading.href" :title="reading.description">{{ reading.title }} <span aria-hidden="true">↗</span></a>
            <span v-if="!selectedReadings.length">阅读内容待配置</span>
          </nav>
          <a class="star-source" href="/星图说明">{{ selectedMansion.missingCount ? `${selectedMansion.name}宿有 ${selectedMansion.missingCount} 颗待考 · ` : '' }}星图与资料来源 ↗</a>
        </section>

        <section class="entries">
          <a class="entry-card entry-main" href="/中药学/">
            <span class="entry-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4.5 10.5h15c0 5-3.3 8-7.5 8s-7.5-3-7.5-8z" />
                <path d="M12 18.5V21" />
                <path d="M9.5 8 14 3.4" />
              </svg>
            </span>
            <div class="entry-body">
              <h2>中药学</h2>
              <p>按「十五五」规划教材 · 21 章分类整理</p>
            </div>
            <span class="card-tag">持续整理中</span>
          </a>

          <div class="classics-grid">
            <a class="entry-card" href="/四大经典/黄帝内经/">
              <span class="entry-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 3a4.5 4.5 0 0 1 0 9 4.5 4.5 0 0 0 0 9" />
                  <circle cx="12" cy="7.5" r="1.1" fill="currentColor" stroke="none" />
                  <circle cx="12" cy="16.5" r="1.1" fill="currentColor" stroke="none" />
                </svg>
              </span>
              <h2>黄帝内经</h2>
              <p>素问 · 灵枢 各 81 篇</p>
            </a>
            <a class="entry-card" href="/四大经典/伤寒论/">
              <span class="entry-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M6.5 4v16M10.2 4v16M13.8 4v16M17.5 4v16" />
                  <path d="M4.5 8.5h15M4.5 15.5h15" />
                </svg>
              </span>
              <h2>伤寒论</h2>
              <p>10 卷 22 篇 · 六经辨证</p>
            </a>
            <a class="entry-card" href="/四大经典/金匮要略/">
              <span class="entry-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="4" y="8.5" width="16" height="11" rx="2" />
                  <path d="M4 8.5 6 4.5h12l2 4" />
                  <path d="M10.5 12.5h3v3h-3z" />
                </svg>
              </span>
              <h2>金匮要略</h2>
              <p>25 篇篇目框架</p>
            </a>
            <a class="entry-card" href="/四大经典/神农本草经/">
              <span class="entry-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 20V9" />
                  <path d="M12 13c-3.2 0-5.5-2-5.5-5.2 3.2 0 5.5 2 5.5 5.2z" />
                  <path d="M12 16c3.2 0 5.5-2 5.5-5.2-3.2 0-5.5 2-5.5 5.2z" />
                </svg>
              </span>
              <h2>神农本草经</h2>
              <p>三品 · 365 味</p>
            </a>
          </div>
        </section>
      </main>

      <footer class="site-footer">
        <p class="foot-motto">只做知识整理与检索 · 不做诊疗建议 · 内容可溯源古籍原文</p>
        <p>© 溯本医源 · yixuebiji.top</p>
      </footer>
    </div>
  </div>
</template>
