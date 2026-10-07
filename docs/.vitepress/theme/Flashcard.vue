<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { parseOldRecords } from './old-record-store.js'

const STORE_KEY = 'sby-flashcards-v1'

const all = ref([])
const status = ref('loading')
const errorMsg = ref('')

const chapters = ref([])
const chapter = ref('全部')
const onlyUnknown = ref(false)
const records = ref({})

const queue = ref([])
const idx = ref(0)
const flipped = ref(false)

const current = computed(() => queue.value[idx.value] ?? null)
const knowCount = computed(() => all.value.filter((c) => records.value[c.name] === 'know').length)
const total = computed(() => all.value.length)

function loadRecords() {
  try {
    records.value = parseOldRecords(localStorage.getItem(STORE_KEY))
  } catch {
    records.value = {}
  }
}

function saveRecords() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(records.value))
  } catch {
    /* 隐私模式下忽略 */
  }
}

function rebuild() {
  let pool = all.value
  if (chapter.value !== '全部') pool = pool.filter((c) => c.chapter === chapter.value)
  if (onlyUnknown.value) pool = pool.filter((c) => records.value[c.name] !== 'know')
  queue.value = pool.slice()
  idx.value = 0
  flipped.value = false
}

function shuffleNow() {
  const q = queue.value
  for (let i = q.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[q[i], q[j]] = [q[j], q[i]]
  }
  queue.value = q.slice()
  idx.value = 0
  flipped.value = false
}

function go(delta) {
  if (!queue.value.length) return
  idx.value = (idx.value + delta + queue.value.length) % queue.value.length
  flipped.value = false
}

function mark(kind) {
  if (!current.value) return
  const name = current.value.name
  records.value = { ...records.value, [name]: kind }
  saveRecords()
  if (onlyUnknown.value && kind === 'know') {
    const currentIndex = idx.value
    queue.value = queue.value.filter((card) => card.name !== name)
    idx.value = queue.value.length ? Math.min(currentIndex, queue.value.length - 1) : 0
    flipped.value = false
    return
  }
  go(1)
}

function resetRecords() {
  if (window.confirm('确定清空全部自测记录吗？此操作不可恢复。')) {
    records.value = {}
    saveRecords()
    rebuild()
  }
}

function onKey(e) {
  const target = e.target
  if (target instanceof Element) {
    const interactive = target.closest('button, a, input, select, textarea')
    if (
      (interactive && /^(BUTTON|A|INPUT|SELECT|TEXTAREA)$/.test(interactive.tagName)) ||
      target.isContentEditable ||
      target.closest('[contenteditable]:not([contenteditable="false"])')
    ) return
  }
  if (e.code === 'Space' || e.key === 'Enter') {
    e.preventDefault()
    flipped.value = !flipped.value
  } else if (e.key === 'ArrowRight') {
    go(1)
  } else if (e.key === 'ArrowLeft') {
    go(-1)
  }
}

onMounted(async () => {
  loadRecords()
  window.addEventListener('keydown', onKey)
  try {
    const res = await fetch(import.meta.env.BASE_URL + 'flashcards.json')
    if (!res.ok) throw new Error('HTTP ' + res.status)
    all.value = await res.json()
    chapters.value = [...new Set(all.value.map((c) => c.chapter))]
    rebuild()
    status.value = 'ready'
  } catch (e) {
    status.value = 'error'
    errorMsg.value = String(e)
  }
})

onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
watch([chapter, onlyUnknown], rebuild)
</script>

<template>
  <div class="fc">
    <div class="fc-bar">
      <select v-model="chapter" class="fc-select" aria-label="按章节筛选">
        <option>全部</option>
        <option v-for="c in chapters" :key="c">{{ c }}</option>
      </select>
      <label class="fc-check">
        <input v-model="onlyUnknown" type="checkbox" />
        只练未掌握
      </label>
      <button class="fc-btn" @click="shuffleNow">打乱顺序</button>
      <button class="fc-btn fc-btn-ghost" @click="resetRecords">清空记录</button>
      <span class="fc-stat">已掌握 {{ knowCount }} / {{ total }}</span>
    </div>

    <div v-if="status === 'loading'" class="fc-empty">正在加载药卡数据…</div>
    <div v-else-if="status === 'error'" class="fc-empty">数据加载失败：{{ errorMsg }}</div>

    <template v-else-if="current">
      <div class="fc-count">{{ idx + 1 }} / {{ queue.length }}</div>
      <div class="fc-card" :class="{ 'is-flipped': flipped }" @click="flipped = !flipped">
        <div class="fc-inner">
          <div class="fc-face fc-front">
            <div class="fc-tag">
              {{ current.chapter }}<template v-if="current.subsection"> · {{ current.subsection }}</template>
            </div>
            <div class="fc-name">{{ current.name }}</div>
            <div class="fc-hint">回忆性味归经与功效 · 点击翻开</div>
          </div>
          <div class="fc-face fc-back">
            <div v-if="current.suji" class="fc-suji">{{ current.suji }}</div>
            <div class="fc-row"><span class="fc-label">性味</span><span>{{ current.xingwei }}</span></div>
            <div class="fc-row"><span class="fc-label">归经</span><span>{{ current.guijing }}</span></div>
            <ul class="fc-gx">
              <li v-for="g in current.gongxiao" :key="g">{{ g }}</li>
            </ul>
            <a class="fc-link" :href="current.url" @click.stop>查看完整药卡 →</a>
          </div>
        </div>
      </div>
      <div class="fc-actions">
        <button class="fc-btn" @click.stop="go(-1)">← 上一张</button>
        <button class="fc-btn fc-btn-warn" @click.stop="mark('unknown')">还要练</button>
        <button class="fc-btn fc-btn-good" @click.stop="mark('know')">记住了</button>
        <button class="fc-btn" @click.stop="go(1)">下一张 →</button>
      </div>
      <p class="fc-tip">快捷键：空格翻面 · ← → 切换卡片 · 记录保存在本机浏览器</p>
    </template>

    <div v-else class="fc-empty">
      该筛选下暂无可练的卡片
      <template v-if="onlyUnknown">（可能都已掌握，试试取消「只练未掌握」）</template>
    </div>
  </div>
</template>

<style scoped>
.fc {
  max-width: 620px;
  margin: 0 auto;
}
.fc-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  margin-bottom: 18px;
}
.fc-select {
  background: var(--sby-bg-card);
  color: var(--sby-text-1);
  border: 1px solid var(--sby-border);
  border-radius: 8px;
  padding: 7px 10px;
  font-size: 13px;
  outline: none;
}
.fc-select:hover {
  border-color: var(--sby-border-hover);
}
.fc-check {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--sby-text-2);
  font-size: 13px;
  cursor: pointer;
  user-select: none;
}
.fc-count {
  text-align: center;
  color: var(--sby-text-3);
  font-size: 13px;
  margin-bottom: 10px;
  font-variant-numeric: tabular-nums;
}
.fc-stat {
  margin-left: auto;
  color: var(--sby-text-2);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}

.fc-btn {
  background: var(--sby-bg-card);
  border: 1px solid var(--sby-border);
  color: var(--sby-text-1);
  border-radius: 8px;
  padding: 7px 14px;
  font-size: 13px;
  cursor: pointer;
  transition:
    background 0.2s var(--sby-ease-out),
    border-color 0.2s var(--sby-ease-out);
}
.fc-btn:hover {
  background: var(--sby-bg-card-hover);
  border-color: var(--sby-border-hover);
}
.fc-btn-ghost {
  color: var(--sby-text-2);
}
.fc-btn-good {
  border-color: rgba(59, 130, 246, 0.45);
  color: var(--sby-accent-soft);
}
.fc-btn-good:hover {
  background: rgba(59, 130, 246, 0.12);
}
.fc-btn-warn {
  border-color: rgba(168, 50, 40, 0.45);
  color: #d97b72;
}
.fc-btn-warn:hover {
  background: rgba(168, 50, 40, 0.12);
}

.fc-card {
  height: 380px;
  perspective: 1400px;
  cursor: pointer;
}
.fc-inner {
  position: relative;
  width: 100%;
  height: 100%;
  transform-style: preserve-3d;
  transition: transform 0.55s var(--sby-ease-out);
}
.fc-card.is-flipped .fc-inner {
  transform: rotateY(180deg);
}
.fc-face {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  padding: 28px;
  border: 1px solid var(--sby-border);
  border-radius: 16px;
  background: linear-gradient(160deg, var(--sby-bg-card), var(--sby-bg-surface));
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}
.fc-front {
  align-items: center;
  justify-content: center;
  text-align: center;
}
.fc-tag {
  position: absolute;
  top: 18px;
  left: 22px;
  color: var(--sby-text-3);
  font-size: 12px;
  letter-spacing: 1px;
}
.fc-name {
  font-size: 44px;
  font-weight: 600;
  letter-spacing: 6px;
  color: var(--sby-text-1);
}
.fc-hint {
  margin-top: 18px;
  color: var(--sby-text-3);
  font-size: 13px;
}
.fc-back {
  transform: rotateY(180deg);
  overflow-y: auto;
  text-align: left;
}
.fc-suji {
  padding: 10px 14px;
  margin-bottom: 16px;
  border-left: 3px solid var(--sby-accent);
  border-radius: 6px;
  background: rgba(59, 130, 246, 0.1);
  color: var(--sby-accent-soft);
  font-size: 15px;
}
.fc-row {
  display: flex;
  gap: 12px;
  margin-bottom: 8px;
  font-size: 14px;
  color: var(--sby-text-1);
}
.fc-label {
  flex: none;
  color: var(--sby-text-3);
}
.fc-gx {
  margin: 8px 0 14px;
  padding-left: 0;
  list-style: none;
}
.fc-gx li {
  position: relative;
  padding-left: 16px;
  margin: 4px 0;
  font-size: 14px;
  color: var(--sby-text-1);
}
.fc-gx li::before {
  content: '';
  position: absolute;
  left: 2px;
  top: 0.62em;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--sby-accent);
}
.fc-link {
  margin-top: auto;
  color: var(--sby-accent-soft);
  font-size: 13px;
  text-decoration: none;
}
.fc-link:hover {
  text-decoration: underline;
}
.fc-actions {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin-top: 18px;
}
.fc-tip {
  margin-top: 14px;
  text-align: center;
  color: var(--sby-text-3);
  font-size: 12px;
}
.fc-empty {
  padding: 60px 0;
  text-align: center;
  color: var(--sby-text-3);
  font-size: 14px;
}

@media (max-width: 640px) {
  .fc-card {
    height: 420px;
  }
  .fc-name {
    font-size: 34px;
    letter-spacing: 4px;
  }
  .fc-face {
    padding: 20px;
  }
}
</style>
