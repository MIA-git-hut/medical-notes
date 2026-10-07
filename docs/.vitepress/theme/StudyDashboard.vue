<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Rating, StudyCard, StudySnapshot } from '../../../shared/study'
import { preview } from '../../../shared/scheduler'
import { StudyApiError, studyClient } from './study/client'
import type { AuthProvider } from './study/client'
// @ts-expect-error This small legacy parser is intentionally framework-free JavaScript.
import { parseOldRecords } from './old-record-store.js'

const ratingNames: Record<Rating, string> = { 1: '还要练', 2: '困难', 3: '记住了', 4: '轻松' }
const cards = ref<StudyCard[]>([]), me = ref<Awaited<ReturnType<typeof studyClient.me>> | null>(null)
const data = ref<StudySnapshot | null>(null), loading = ref(true), busy = ref(false)
const error = ref(''), notice = ref(''), category = ref('all'), currentId = ref(''), flipped = ref(false)
const note = ref(''), savedNote = ref(''), limit = ref(20), legacy = ref(false)
const providers = ref<AuthProvider[]>([])
const mode = ref<'review' | 'free'>('review'), now = ref(Date.now())
const syncUnavailable = ref(false), needsRefresh = ref(false)
const serverNote = ref<string | null>(null)
const oldRecords = ref<Record<string, 'know' | 'unknown'>>({}), onlyLegacyUnknown = ref(false)
const freeOrder = ref<string[]>([])
const controls = ref<HTMLElement | null>(null), cardMain = ref<HTMLElement | null>(null)
const chapterSearch = ref(''), reducedMotion = ref(false)
const pendingReview = ref<{ cardId: string; rating: Rating; expectedVersion: number; requestId: string } | null>(null)
let clock: ReturnType<typeof setInterval> | undefined
const progress = computed(() => new Map((data.value?.progress || []).map(x => [x.cardId, x])))
const notes = computed(() => new Map((data.value?.notes || []).map(x => [x.cardId, x])))
const categories = computed(() => [...new Map(cards.value.map(x => [x.categoryId, x.category]))].map(([id, name]) => ({ id, name })))
const pool = computed(() => category.value === 'all' ? cards.value : cards.value.filter(x => x.categoryId === category.value))
const freePool = computed(() => {
  const visible = onlyLegacyUnknown.value ? pool.value.filter(card => oldRecords.value[card.herb!.name] !== 'know') : pool.value
  const byId = new Map(visible.map(card => [card.id, card]))
  return freeOrder.value.map(id => byId.get(id)).filter((card): card is StudyCard => !!card)
})
const isNew = (cardId: string) => { const p = progress.value.get(cardId); return !p || p.schedule.reps === 0 || p.schedule.state === 0 }
const queue = computed(() => {
  if (!me.value?.user || !data.value || mode.value === 'free') return freePool.value
  const due = pool.value.filter(x => { const p = progress.value.get(x.id); return p && !isNew(x.id) && Date.parse(p.schedule.due) <= now.value })
    .sort((a, b) => Date.parse(progress.value.get(a.id)!.schedule.due) - Date.parse(progress.value.get(b.id)!.schedule.due))
  const available = Math.max(0, data.value.settings.dailyNewLimit - data.value.newCardsStudiedToday)
  return [...due, ...pool.value.filter(x => isNew(x.id)).slice(0, available)]
})
const current = computed(() => cards.value.find(x => x.id === currentId.value))
const currentHerb = computed(() => current.value?.herb)
const intervals = computed(() => {
  if (!current.value) return null
  const schedule = progress.value.get(current.value.id)?.schedule
  const lastReview = schedule?.last_review ? Date.parse(schedule.last_review) : 0
  return preview(schedule, new Date(Math.max(now.value, lastReview)).toISOString())
})
const history = computed(() => { const ids = new Set(pool.value.map(x => x.id)); return (data.value?.reviews || []).filter(x => ids.has(x.cardId)).sort((a,b) => Date.parse(b.reviewedAt)-Date.parse(a.reviewedAt)).slice(0,20) })
const stats = computed(() => categories.value.map(c => {
  const ids = cards.value.filter(x => x.categoryId === c.id).map(x => x.id)
  const unlearned = ids.filter(isNew).length
  const due = ids.filter(id => !isNew(id) && Date.parse(progress.value.get(id)!.schedule.due) <= now.value).length
  const learning = ids.filter(id => { const p=progress.value.get(id); return p && !isNew(id) && p.schedule.state !== 2 }).length
  const names = cards.value.filter(x => x.categoryId === c.id).map(x => x.herb!.name)
  const oldKnown = names.filter(name=>oldRecords.value[name]==='know').length
  const oldUnknown = names.filter(name=>oldRecords.value[name]==='unknown').length
  return { ...c, total: ids.length, unlearned, due, learning, longTerm: ids.length-unlearned-learning, oldKnown, oldUnknown, practiced: oldKnown+oldUnknown, cloudLearned: ids.length-unlearned }
}))
const visibleStats = computed(() => { const q=chapterSearch.value.trim().toLowerCase();return q?stats.value.filter(item=>item.name.toLowerCase().includes(q)):stats.value })
const selectedStats = computed(() => category.value==='all'?null:stats.value.find(item=>item.id===category.value))
const scheduleGroups = computed(() => categories.value.map(group => {
  const groupCards = cards.value.filter(card => card.categoryId === group.id)
  const scheduled = groupCards.map(card => progress.value.get(card.id)).filter(item => item && !isNew(item.cardId))
  const earliest = scheduled.map(item => item!.schedule.due).sort((a,b) => Date.parse(a)-Date.parse(b))[0] || null
  return { ...group, earliest, due: scheduled.filter(item => Date.parse(item!.schedule.due) <= now.value).length, unlearned: groupCards.filter(card => isNew(card.id)).length }
}).sort((a,b) => (a.earliest ? Date.parse(a.earliest) : Infinity) - (b.earliest ? Date.parse(b.earliest) : Infinity)))
const currentScheduleHint = computed(() => {
  if (!data.value) return ''
  const group = category.value === 'all' ? null : scheduleGroups.value.find(item => item.id === category.value)
  const relevant = group ? [group] : scheduleGroups.value
  const due = relevant.reduce((sum,item) => sum+item.due, 0)
  if (due) return `${group?.name || '全部分类'}已有 ${due} 张到期`
  const earliest = relevant.map(item=>item.earliest).filter((value): value is string=>!!value).sort((a,b)=>Date.parse(a)-Date.parse(b))[0]
  return earliest ? `下次复习：${formatDateTime(earliest)}（${relativeTime(earliest)}）` : '完成一次正式评分后安排复习时间'
})
const noteDirty = computed(() => note.value !== savedNote.value)

function choose() {
  if (!queue.value.some(x => x.id === currentId.value)) currentId.value = queue.value[0]?.id || ''
}
function interval(due: string) {
  const minutes = Math.max(0, Math.round((Date.parse(due) - now.value) / 60000))
  if (minutes < 60) return `${minutes} 分钟`
  if (minutes < 1440) return `${Math.round(minutes / 60)} 小时`
  if (minutes < 43200) return `${Math.round(minutes / 1440)} 天`
  return `${Math.round(minutes / 43200)} 个月`
}
function formatDateTime(value: string) { return new Date(value).toLocaleString('zh-CN', { year:'numeric', month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit' }) }
function relativeTime(value: string) {
  const remaining = Date.parse(value)-now.value
  if (remaining <= 0) return '已到期'
  const minutes = Math.ceil(remaining/60000)
  if (minutes < 60) return `${minutes} 分钟后`
  if (minutes < 1440) return `${Math.round(minutes/60)} 小时后`
  return `${Math.round(minutes/1440)} 天后`
}
function canLeave() {
  return !noteDirty.value || confirm('当前私人笔记尚未保存，确定放弃修改吗？')
}
function loadCurrentNote() {
  const text = current.value ? notes.value.get(current.value.id)?.text || '' : ''
  note.value = text
  savedNote.value = text
}
async function switchCategory(value: string | Event) {
  if (busy.value) return
  const select = value instanceof Event ? value.target as HTMLSelectElement : null
  const next = select?.value || value as string
  if (!canLeave()) { if (select) select.value=category.value; return }
  category.value=next;currentId.value='';flipped.value=false;choose()
  await nextTick()
  closeControls()
  cardMain.value?.scrollIntoView({behavior:reducedMotion.value?'auto':'smooth',block:'start'})
  cardMain.value?.focus({preventScroll:true})
}
function closeControls(returnFocus=false){const summary=controls.value?.querySelector(':scope > details[open] > summary') as HTMLElement|null;controls.value?.querySelectorAll('details[open]').forEach(item=>item.removeAttribute('open'));chapterSearch.value='';if(returnFocus)nextTick(()=>summary?.focus())}
function toggleControl(event:Event){const opened=event.target as HTMLDetailsElement;if(!opened.open||opened.parentElement!==controls.value)return;controls.value?.querySelectorAll(':scope > details[open]').forEach(item=>{if(item!==opened)item.removeAttribute('open')})}
function closeOnOutside(event:PointerEvent){if(controls.value&&!controls.value.contains(event.target as Node))closeControls()}
function switchMode(value: 'review'|'free') {
  if (busy.value || value === mode.value || !canLeave()) return
  mode.value = value
  flipped.value = false
  pendingReview.value = null
  choose()
}
async function refresh() {
  data.value = await studyClient.snapshot()
  now.value = Date.now()
  limit.value = data.value.settings.dailyNewLimit
}
async function rate(rating: Rating) {
  if (mode.value !== 'review' || needsRefresh.value || !flipped.value || busy.value || !current.value || !me.value?.csrfToken) return
  if (noteDirty.value) { error.value='请先保存或撤销当前笔记，再提交评分。'; return }
  busy.value = true; error.value = ''
  const old = current.value.id, p = progress.value.get(old)
  if (!pendingReview.value || pendingReview.value.cardId !== old || pendingReview.value.rating !== rating || pendingReview.value.expectedVersion !== (p?.version || 0))
    pendingReview.value = { cardId: old, rating, expectedVersion: p?.version || 0, requestId: crypto.randomUUID() }
  try {
    const result = await studyClient.review(pendingReview.value, me.value.csrfToken)
    pendingReview.value = null
    flipped.value = false
    const savedMessage = `${current.value?.herb?.name || '药卡'}已评分，下次复习：${formatDateTime(result.review.due)}`
    try { await refresh(); currentId.value = queue.value.find(x => x.id !== old)?.id || queue.value[0]?.id || ''; notice.value=savedMessage }
    catch { needsRefresh.value=true; notice.value=`${savedMessage}。学习数据刷新失败，刷新成功后可继续评分。` }
  } catch (e) { error.value = e instanceof StudyApiError && e.status === 409 ? '进度已在别处更新，请刷新后再评分。当前卡片仍保留。' : String(e instanceof Error ? e.message : e) }
  finally { busy.value = false }
}
async function saveNote() {
  if (!current.value || !me.value?.csrfToken || busy.value) return
  busy.value = true; error.value = ''
  const cardId = current.value.id
  const draft = note.value
  const old = notes.value.get(cardId)
  try {
    const saved = await studyClient.note(cardId, draft, old?.version || 0, me.value.csrfToken)
    if(data.value) data.value.notes = [...data.value.notes.filter(x => x.cardId !== saved.cardId), saved]
    savedNote.value = draft
    serverNote.value = null
    notice.value = '私人笔记已保存'
  } catch(e) {
    if (e instanceof StudyApiError && e.status === 409) {
      try {
        const latest = await studyClient.snapshot()
        now.value = Date.now()
        const latestNote = latest.notes.find(item => item.cardId === cardId)
        if (data.value) {
          data.value.notes = [
            ...data.value.notes.filter(item => item.cardId !== cardId),
            ...(latestNote ? [latestNote] : []),
          ]
        }
        serverNote.value = latestNote?.text || ''
        error.value = '笔记已有新版本。草稿已保留，请参考服务端版本合并后再次保存。'
      } catch { error.value = '笔记已有新版本，且暂时无法读取最新内容。当前草稿仍已保留。' }
    } else error.value = String(e instanceof Error ? e.message : e)
  }
  finally { busy.value = false }
}
async function reset() { if(category.value==='all'||!me.value?.csrfToken||busy.value||!canLeave()||!confirm('重置当前分类进度？复习历史和笔记会保留。'))return;busy.value=true;error.value='';try{await studyClient.reset(category.value,me.value.csrfToken);await refresh();flipped.value=false;choose();notice.value='已重置当前分类进度，历史和笔记仍保留'}catch(e){error.value=String(e instanceof Error?e.message:e)}finally{busy.value=false} }
async function settings() { if(!data.value||!me.value?.csrfToken||busy.value||!canLeave())return;busy.value=true;error.value='';try{const value=Math.max(0,Math.min(100,Math.round(limit.value)));await studyClient.settings(value,data.value.settings.timezone,me.value.csrfToken);await refresh();choose();notice.value='每日目标已更新'}catch(e){error.value=String(e instanceof Error?e.message:e)}finally{busy.value=false} }
async function logout(){if(!me.value?.csrfToken||busy.value||!canLeave())return;busy.value=true;error.value='';try{await studyClient.logout(me.value.csrfToken);location.reload()}catch(e){error.value=String(e instanceof Error?e.message:e);busy.value=false}}
async function manualRefresh(){
  if(busy.value||!canLeave())return
  busy.value=true;error.value=''
  try{
    const [identity, auth] = await Promise.all([studyClient.me(), studyClient.providers()])
    me.value = identity
    providers.value = auth.providers.filter(provider => provider.enabled)
    if (identity.user && identity.configured) {
      await refresh(); choose(); loadCurrentNote()
    } else {
      data.value=null
      mode.value='free'
      loadCurrentNote()
      serverNote.value=null
    }
    needsRefresh.value=false;syncUnavailable.value=false;notice.value='学习数据已刷新'
  }catch(e){syncUnavailable.value=true;error.value=String(e instanceof Error?e.message:e)}finally{busy.value=false}
}
function next(){if(busy.value||!canLeave())return;const i=queue.value.findIndex(x=>x.id===currentId.value);currentId.value=queue.value[(i+1)%queue.value.length]?.id||'';flipped.value=false}
function previous(){if(busy.value||!canLeave())return;const i=queue.value.findIndex(x=>x.id===currentId.value);currentId.value=queue.value[(i-1+queue.value.length)%queue.value.length]?.id||'';flipped.value=false}
function shuffleFree(){if(busy.value||!canLeave())return;const ids=freePool.value.map(card=>card.id);for(let i=ids.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[ids[i],ids[j]]=[ids[j],ids[i]]}const set=new Set(ids);freeOrder.value=[...ids,...freeOrder.value.filter(id=>!set.has(id))];currentId.value=ids[0]||'';flipped.value=false}
function setLegacyFilter(event: Event){const input=event.target as HTMLInputElement;if(busy.value||!canLeave()){input.checked=onlyLegacyUnknown.value;return}onlyLegacyUnknown.value=input.checked;flipped.value=false;choose()}
function markLegacy(status: 'know' | 'unknown') {
  if (busy.value || !currentHerb.value || !canLeave()) return
  notice.value = ''
  const before = [...queue.value]
  const index = before.findIndex(card => card.id === currentId.value)
  const nextId = before.length > 1 ? before[(index + 1) % before.length].id : ''
  const merged = { ...oldRecords.value, [currentHerb.value.name]: status }
  try {
    localStorage.setItem('sby-flashcards-v1', JSON.stringify(merged))
  } catch {
    error.value = '本机掌握记录保存失败，请检查浏览器存储设置。'
    return
  }
  oldRecords.value = merged
  legacy.value = true
  flipped.value = false
  currentId.value = nextId && queue.value.some(card => card.id === nextId) ? nextId : queue.value[0]?.id || ''
  notice.value = status === 'know' ? '已记为“记住了”（仅保存在本机）' : '已记为“还要练”（仅保存在本机）'
}
function key(e:KeyboardEvent){if(e.key==='Escape'){closeControls(true);return}const t=e.target as HTMLElement;if(t?.matches('input,textarea,select,button,a,summary,[contenteditable="true"]')||t?.isContentEditable)return;if(e.code==='Space'){e.preventDefault();flipped.value=!flipped.value}else if(flipped.value&&/^[1-4]$/.test(e.key))rate(Number(e.key) as Rating)}
function beforeUnload(event: BeforeUnloadEvent) {
  if (!noteDirty.value) return
  event.preventDefault()
  event.returnValue = ''
}
watch(queue, choose)
watch(currentId, () => { loadCurrentNote(); serverNote.value=null; flipped.value = false })
onMounted(async () => {
  window.addEventListener('keydown', key)
  window.addEventListener('beforeunload', beforeUnload)
  document.addEventListener('pointerdown', closeOnOutside)
  reducedMotion.value=window.matchMedia('(prefers-reduced-motion: reduce)').matches
  clock = setInterval(() => now.value = Date.now(), 30000)
  try { const stored=localStorage.getItem('sby-flashcards-v1');legacy.value=!!stored;oldRecords.value=parseOldRecords(stored) } catch { legacy.value = false;oldRecords.value={} }
  try { const loaded=await studyClient.cards();cards.value=loaded.filter(card=>card.kind==='herb'&&!!card.herb);freeOrder.value=cards.value.map(card=>card.id);choose() }
  catch (e) { error.value = `卡片加载失败：${String(e instanceof Error ? e.message : e)}` }
  const [identity, auth] = await Promise.allSettled([studyClient.me(), studyClient.providers()])
  if (identity.status === 'fulfilled') me.value = identity.value
  if (auth.status === 'fulfilled') providers.value = auth.value.providers.filter(provider => provider.enabled)
  if (identity.status === 'fulfilled' && identity.value.user && identity.value.configured) {
    try { await refresh() } catch { syncUnavailable.value = true }
  } else mode.value = 'free'
  if (identity.status === 'rejected' || auth.status === 'rejected') syncUnavailable.value = true
  if (syncUnavailable.value) { mode.value = 'free'; error.value ||= '同步服务暂不可用，仍可自由练习。' }
  choose()
  loadCurrentNote()
  loading.value = false
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', key)
  window.removeEventListener('beforeunload', beforeUnload)
  document.removeEventListener('pointerdown', closeOnOutside)
  if (clock) clearInterval(clock)
})
</script>

<template><div class="study">
  <div v-if="loading" class="panel empty">正在加载学习卡片…</div><template v-else>
  <div v-if="syncUnavailable" class="banner">同步暂不可用，仍可自由练习。 <button :disabled="busy" @click="manualRefresh">重新连接</button></div>
  <div v-else-if="me && !me.configured" class="banner">学习服务尚未开放。本机掌握记录可保存，跨设备同步未启用。</div>
  <div v-else-if="!me?.user" class="banner">登录后可同步进度和私人笔记。 <a v-for="provider in providers" :key="provider.id" :href="provider.startUrl" rel="external" target="_self">使用 {{provider.label}} 登录</a></div>
  <div v-if="legacy" class="legacy">旧版自测记录仍保留在本地，不会自动转入新的学习记录。</div>
  <div v-if="error" class="alert">{{error}} <button v-if="!noteDirty" :disabled="busy" @click="manualRefresh">刷新学习数据</button></div><div v-if="notice" class="notice">{{notice}} <button v-if="needsRefresh" :disabled="busy" @click="manualRefresh">立即刷新</button></div>
  <header><span class="identity">{{me?.user ? me.user.login : '自由练习'}}</span><div v-if="me?.user" class="modes"><button :disabled="busy" :class="{active:mode==='review'}" @click="switchMode('review')">正式复习</button><button :disabled="busy" :class="{active:mode==='free'}" @click="switchMode('free')">自由练习</button></div><a v-if="me?.isAdmin" href="/管理/">管理统计</a><span v-if="data" class="today">今日新卡 {{data.newCardsStudiedToday}} / {{data.settings.dailyNewLimit}}</span><button v-if="me?.user" :disabled="busy" @click="logout">退出</button></header>
  <section ref="controls" class="controls panel"><label>学习分类<select :value="category" :disabled="busy" @change="switchCategory($event)"><option value="all">全部分类</option><option v-for="c in categories" :value="c.id">{{c.name}}</option></select></label>
    <details class="category-stats" @toggle="toggleControl"><summary>章节学习概况</summary><div class="chapter-picker"><div class="picker-tools"><input v-model="chapterSearch" aria-label="搜索章节" type="search" placeholder="搜索章节"><button aria-label="关闭章节选择" @click="closeControls(true)">关闭</button></div><div v-if="!visibleStats.length" class="empty-search">没有匹配的章节</div><div v-else class="chapter-list"><details v-for="s in visibleStats" :key="s.id" class="chapter" :class="{selected:category===s.id}"><summary><span>{{s.name}}</span><small v-if="data&&mode==='review'">已学 {{s.cloudLearned}} / {{s.total}}</small><small v-else>已练 {{s.practiced}} / {{s.total}}</small></summary><div class="chapter-body"><small>本机练习：总数 {{s.total}} / 已练 {{s.practiced}} / 未练 {{s.total-s.practiced}} / 记住 {{s.oldKnown}} / 还要练 {{s.oldUnknown}}</small><small v-if="data">账号复习：已学 {{s.cloudLearned}} / 总数 {{s.total}} / 未学 {{s.unlearned}} / 到期 {{s.due}}</small><button class="cat" :disabled="busy" :class="{active:category===s.id}" @click="switchCategory(s.id)">进入本章</button></div></details></div></div></details>
    <details class="schedule" @toggle="toggleControl"><summary>复习日程</summary><div class="schedule-picker"><template v-if="data"><p class="schedule-timezone">按本机时区显示；每组时间为组内最早一张已安排药卡的复习时间。</p><div class="schedule-list"><button v-for="group in scheduleGroups" :key="group.id" :disabled="busy" @click="switchCategory(group.id)"><b>{{group.name}}</b><span v-if="group.earliest">{{formatDateTime(group.earliest)}} · {{relativeTime(group.earliest)}}</span><span v-else>尚未安排</span><small>到期 {{group.due}} · 未学 {{group.unlearned}}</small></button></div></template><p v-else>本机掌握标记不生成复习时间；登录并完成正式评分后安排。</p></div></details>
    <details v-if="data" class="settings" @toggle="toggleControl"><summary>学习设置</summary><div class="settings-picker"><label>每日新卡目标<div class="row"><input v-model.number="limit" type="number" min="0" max="100"><button :disabled="busy" @click="settings">保存</button></div></label><button v-if="category!=='all'" class="danger" :disabled="busy" @click="reset">重置当前分类进度</button></div></details>
  </section>
  <p class="next-review">{{data ? currentScheduleHint : '未安排复习 · 登录后正式评分可生成日程。'}}</p>
  <main ref="cardMain" class="study-main" tabindex="-1"><div v-if="selectedStats" class="group-summary"><template v-if="data&&mode==='review'">{{selectedStats.name}} · 已学 {{selectedStats.cloudLearned}} / {{selectedStats.total}} · 未学 {{selectedStats.unlearned}} · 到期 {{selectedStats.due}}</template><template v-else>{{selectedStats.name}} · 已练 {{selectedStats.practiced}} / {{selectedStats.total}} · 未练 {{selectedStats.total-selectedStats.practiced}}</template></div><div v-if="!current" class="panel empty">{{me?.user?'当前没有到期卡片或可用新卡。':'这个分类暂无卡片。'}}</div><template v-else>
    <div class="meta"><span>{{currentHerb?.chapter}}<template v-if="currentHerb?.subsection"> · {{currentHerb.subsection}}</template></span><span>{{mode==='review'?`待复习 ${queue.length} 张`:'自由练习'}}</span></div>
    <div v-if="mode==='free'" class="free-tools"><label><input type="checkbox" :checked="onlyLegacyUnknown" :disabled="busy" @change="setLegacyFilter"> 仅看未掌握</label><button :disabled="busy" @click="shuffleFree">打乱顺序</button></div>
    <button class="card" :class="{flipped}" @click="flipped=!flipped"><small>{{flipped?'药卡':'回忆'}}</small><span v-if="!flipped" class="card-content herb-name">{{currentHerb?.name}}</span><span v-else class="card-content herb-answer"><span class="herb-answer-name">{{currentHerb?.name}}</span><span v-if="currentHerb?.suji" class="herb-suji">{{currentHerb.suji}}</span><span v-if="currentHerb?.xingwei" class="herb-row"><b>性味</b><span>{{currentHerb.xingwei}}</span></span><span v-if="currentHerb?.guijing" class="herb-row"><b>归经</b><span>{{currentHerb.guijing}}</span></span><span v-if="currentHerb?.gongxiao.length" class="herb-list"><b>功效</b><span v-for="item in currentHerb.gongxiao" :key="item">{{item}}</span></span><span v-if="currentHerb?.zhuzhi.length" class="herb-list"><b>主治</b><span v-for="item in currentHerb.zhuzhi" :key="item">{{item}}</span></span></span><em>{{flipped?'请按实际回忆情况评分':'回忆性味、归经、功效与主治 · 点击或按空格翻面'}}</em></button>
    <div v-if="current.status==='unverified'" class="provenance">原有笔记 · 待核对</div><div v-if="oldRecords[currentHerb?.name||'']" class="old-status">旧记录：{{oldRecords[currentHerb?.name||'']==='know'?'认识':'待复习'}}</div>
    <template v-if="me?.user&&mode==='review'"><div class="primary-marks"><button class="practice" :disabled="needsRefresh||!flipped||busy" @click="rate(1)"><b>还要练</b><small>{{intervals?interval(intervals[1].due):'—'}}</small></button><button class="remember" :disabled="needsRefresh||!flipped||busy" @click="rate(3)"><b>记住了</b><small>{{intervals?interval(intervals[3].due):'—'}}</small></button></div><details class="rating-more"><summary>更多评分</summary><div class="ratings"><button :disabled="needsRefresh||!flipped||busy" @click="rate(2)"><b>困难</b><small>{{intervals?interval(intervals[2].due):'—'}}</small></button><button :disabled="needsRefresh||!flipped||busy" @click="rate(4)"><b>轻松</b><small>{{intervals?interval(intervals[4].due):'—'}}</small></button></div></details></template><template v-else><div class="primary-marks"><button class="practice" :disabled="busy" @click="markLegacy('unknown')">还要练</button><button class="remember" :disabled="busy" @click="markLegacy('know')">记住了</button></div><div class="next"><button :disabled="busy" @click="previous">上一张</button><button :disabled="busy" @click="next">下一张</button></div></template>
    <p class="estimate">下次间隔为调度估算，并不代表记忆能保持的真实时长。</p><div class="links"><a :href="current.noteUrl">查看原笔记</a><a v-if="current.sourceUrl!==current.noteUrl" :href="current.sourceUrl">{{current.sourceTitle||'查看来源'}}</a></div>
    <section v-if="data" class="panel notes"><h2>私人笔记</h2><textarea v-model="note" :disabled="busy" rows="5" placeholder="纯文本，仅自己可见"></textarea><div v-if="serverNote!==null" class="server-note"><b>服务端最新版本（只读）</b><pre>{{serverNote || '（空笔记）'}}</pre></div><button :disabled="busy" @click="saveNote">{{serverNote!==null?'保存合并后的笔记':'保存笔记'}}</button></section>
  </template></main>
  <section v-if="data" class="panel history"><h2>当前分类复习历史</h2><p v-if="!history.length">暂无复习记录</p><ul><li v-for="h in history" :key="h.id"><span>{{cards.find(c=>c.id===h.cardId)?.herb?.name||h.cardId}}</span><b>{{ratingNames[h.rating]}}</b><time>{{new Date(h.reviewedAt).toLocaleString('zh-CN')}}</time></li></ul></section>
  </template></div></template>

<style scoped>
.study{max-width:980px;min-width:0;margin:auto;color:var(--sby-text-1,var(--vp-c-text-1))}.panel{background:var(--sby-bg-card,var(--vp-c-bg-soft));border:1px solid var(--sby-border,var(--vp-c-divider));border-radius:14px}.banner,.legacy,.alert,.notice{padding:12px 15px;margin-bottom:12px;border-radius:9px;background:var(--vp-c-brand-soft);font-size:14px;overflow-wrap:anywhere}.legacy{background:var(--vp-c-bg-soft);color:var(--vp-c-text-2)}.alert{background:var(--vp-c-danger-soft);color:var(--vp-c-danger-1)}header,.row,.meta,.links,.modes{display:flex;align-items:center;gap:12px}header{margin:12px 0;flex-wrap:wrap}.identity{font-weight:600}.today{margin-left:auto;color:var(--vp-c-text-2)}.modes{gap:3px;padding:3px;background:var(--vp-c-bg-soft);border-radius:9px}.modes button{border:0;background:none;padding:7px 9px;border-radius:6px}.modes button.active{background:var(--vp-c-bg);color:var(--vp-c-brand-1)}button,select,input,textarea{font:inherit;color:inherit}.study>main{min-width:0}label{display:block;font-size:12px;color:var(--vp-c-text-2);margin-bottom:14px}select,input,textarea{box-sizing:border-box;width:100%;padding:8px;border:1px solid var(--vp-c-divider);border-radius:8px;background:var(--vp-c-bg)}.category-stats summary{margin-bottom:6px;font-size:12px;color:var(--vp-c-text-2);cursor:pointer}.cat{display:flex;width:100%;align-items:flex-start;justify-content:space-between;gap:6px;border:0;border-radius:7px;padding:8px;background:none;text-align:left}.cat small{text-align:right;color:var(--vp-c-text-3);font-size:10px;line-height:1.5;white-space:nowrap}.cat.active,.cat:hover{background:var(--vp-c-brand-soft)}.danger{border:0;background:none;color:var(--vp-c-danger-1)}.meta,.links{justify-content:space-between;font-size:13px;color:var(--vp-c-text-2);margin:0 2px 10px}.links{flex-wrap:wrap}.links a{overflow-wrap:anywhere}.card{width:100%;min-height:310px;padding:28px;display:flex;flex-direction:column;text-align:left;border:1px solid var(--vp-c-divider);border-radius:18px;background:var(--sby-bg-card,var(--vp-c-bg-soft));overflow-wrap:anywhere}.card.flipped{border-color:var(--vp-c-brand-1)}.card>small{color:var(--vp-c-brand-1)}.card>span{margin:auto 0;font-size:20px;line-height:1.75;white-space:pre-wrap}.card>em{font-size:12px;color:var(--vp-c-text-3);font-style:normal}.ratings{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:12px}.ratings button{position:relative;min-height:44px;padding:9px;border:1px solid var(--vp-c-divider);border-radius:9px;background:var(--vp-c-bg-soft)}.ratings button>*{display:block}.ratings kbd{position:absolute;right:6px;top:5px}.next{text-align:right;margin-top:12px}.next button,.notes button{min-height:44px}.estimate{text-align:center;font-size:12px;color:var(--vp-c-text-3)}.notes,.history{padding:16px;margin-top:20px;min-width:0}.notes h2,.history h2{font-size:16px;margin:0 0 10px}.notes textarea{resize:vertical}.server-note{margin:8px 0;padding:10px;border-left:3px solid var(--vp-c-warning-1);background:var(--vp-c-bg)}.server-note b{font-size:12px}.server-note pre{margin:6px 0 0;white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;color:var(--vp-c-text-2)}.history ul{list-style:none;padding:0}.history li{display:grid;grid-template-columns:minmax(0,1fr) 50px 150px;gap:10px;border-top:1px solid var(--vp-c-divider);padding:8px;font-size:13px}.history li span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.empty{padding:35px;text-align:center}
.free-tools{display:flex;align-items:center;justify-content:flex-end;gap:12px;margin-bottom:8px}.free-tools label{margin:0}.free-tools input{width:auto}.free-tools button{border:1px solid var(--vp-c-divider);border-radius:7px;background:var(--vp-c-bg-soft);padding:6px 10px}.card>.herb-name{font-size:42px;font-weight:600;letter-spacing:.12em}.card>.herb-answer{display:flex;flex-direction:column;gap:12px;width:100%;font-size:15px;line-height:1.65;white-space:normal}.herb-answer-name{font-size:24px;font-weight:600;letter-spacing:.1em}.herb-suji{color:var(--vp-c-brand-1);font-size:16px}.herb-row,.herb-list{display:grid;grid-template-columns:52px minmax(0,1fr);gap:10px}.herb-row b,.herb-list b{color:var(--vp-c-text-2);font-size:12px}.herb-list>span{grid-column:2}.provenance,.old-status{display:inline-block;margin:8px 8px 0 0;padding:4px 8px;border-radius:999px;background:var(--vp-c-warning-soft);color:var(--vp-c-warning-1);font-size:11px}.old-status{background:var(--vp-c-bg-soft);color:var(--vp-c-text-2)}.next{display:flex;justify-content:flex-end;gap:8px}
.category-stats>summary{margin-bottom:6px;font-size:12px;color:var(--vp-c-text-2);cursor:pointer}.chapter-list{display:grid;gap:6px;margin-bottom:14px}.chapter{border-bottom:1px solid var(--vp-c-divider);padding:5px 0}.chapter summary{font-size:13px;cursor:pointer}.chapter-body{display:grid;gap:7px;padding:8px 0}.chapter-body small{color:var(--vp-c-text-3);line-height:1.5}.chapter-body .cat{justify-content:center;border:1px solid var(--vp-c-divider)}.primary-marks{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:14px}.primary-marks button{min-height:50px;border:1px solid var(--vp-c-divider);border-radius:10px;background:var(--vp-c-bg-soft);font-size:15px}.primary-marks button b,.primary-marks button small{display:block}.primary-marks .practice{border-color:var(--vp-c-warning-1)}.primary-marks .remember{border-color:var(--vp-c-brand-1)}.rating-more{margin-top:8px;text-align:center}.rating-more summary{color:var(--vp-c-text-3);font-size:12px;cursor:pointer}.rating-more .ratings{grid-template-columns:repeat(2,minmax(0,1fr));max-width:360px;margin:8px auto 0}
.controls{display:grid;grid-template-columns:minmax(180px,1fr) repeat(3,minmax(130px,auto));align-items:start;gap:10px;padding:12px;margin-bottom:10px}.controls>label{margin:0}.controls>details{margin:0;min-width:0}.controls>details>summary{margin:0}.controls>details>summary{min-height:38px;line-height:38px;padding:0 9px;border:1px solid var(--vp-c-divider);border-radius:8px;cursor:pointer;color:var(--vp-c-text-2);font-size:13px}.controls>details[open]{grid-column:1/-1}.controls>details[open]>summary{margin-bottom:8px}.schedule-list{display:grid;gap:6px}.schedule-list button{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:12px;text-align:left;padding:9px;border:0;border-radius:7px;background:var(--vp-c-bg);color:var(--vp-c-text-1)}.schedule-list button span,.schedule-list button small{color:var(--vp-c-text-2)}.schedule>p{margin:8px 0;color:var(--vp-c-text-2);font-size:13px}.settings>label{max-width:320px}.next-review{margin:0 2px 10px;color:var(--vp-c-text-2);font-size:13px}
.controls{position:relative;z-index:4}.controls>details[open]{grid-column:auto}.chapter-picker,.schedule-picker,.settings-picker{position:absolute;z-index:10;top:calc(100% + 6px);left:0;width:100%;box-sizing:border-box;max-height:min(55dvh,360px);overflow:auto;padding:12px;border:1px solid var(--vp-c-divider);border-radius:12px;background:var(--vp-c-bg);box-shadow:0 18px 45px rgba(0,0,0,.2)}.picker-tools{position:sticky;top:-12px;z-index:2;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;padding:0 0 10px;background:var(--vp-c-bg)}.picker-tools button{border:1px solid var(--vp-c-divider);border-radius:8px;background:var(--vp-c-bg-soft)}.chapter summary{display:flex;justify-content:space-between;gap:8px}.chapter summary small{color:var(--vp-c-text-3);white-space:nowrap}.chapter.selected{border-left:3px solid var(--vp-c-brand-1);padding-left:8px}.settings-picker>label{max-width:320px}.group-summary{margin:0 2px 8px;color:var(--vp-c-text-2);font-size:13px}.study-main:focus{outline:none}
.controls>details[open]>summary{margin-bottom:0}.chapter summary{display:list-item}.chapter summary small{float:right;margin-left:8px}.empty-search{padding:24px;text-align:center;color:var(--vp-c-text-3)}.study-main{scroll-margin-top:100px}.study-main:focus{outline:none}
.chapter{margin:0;padding:0}.chapter>summary{min-height:40px;margin:0;line-height:40px}.chapter-body small,.chapter summary small{color:var(--vp-c-text-2)}
@media(max-width:700px){header{align-items:center;margin:8px 0}.identity{max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.today{margin-left:0;order:3;font-size:12px}.modes{flex:1}.modes button{flex:1;min-height:44px}.controls{grid-template-columns:1fr 1fr;padding:10px}.controls>label{grid-column:1/-1}.controls>.settings{grid-column:1/-1}.chapter-picker,.schedule-picker,.settings-picker{position:fixed;top:auto;right:12px;bottom:16px;left:12px;width:auto;max-height:min(55dvh,360px)}.schedule-list button{grid-template-columns:1fr}.card{min-height:240px;padding:20px}.ratings{grid-template-columns:repeat(2,minmax(0,1fr))}.ratings button{min-height:52px}.history li{grid-template-columns:minmax(0,1fr) 45px}.history time{display:none}.links{align-items:flex-start;flex-direction:column;gap:5px}}
@media(max-width:380px){.study{font-size:14px}.banner,.legacy,.alert,.notice{padding:10px}.card{min-height:220px;padding:16px}.card>span{font-size:18px}.notes,.history{padding:12px}.meta{gap:6px}.meta span:last-child{white-space:nowrap}}
@media(max-height:500px) and (orientation:landscape){.card{min-height:180px}}
</style>
