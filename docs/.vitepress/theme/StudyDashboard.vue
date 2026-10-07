<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Rating, StudyCard, StudySnapshot } from '../../../shared/study'
import { preview } from '../../../shared/scheduler'
import { StudyApiError, studyClient } from './study/client'
import type { AuthProvider } from './study/client'

const ratingNames: Record<Rating, string> = { 1: '忘记', 2: '困难', 3: '记得', 4: '轻松' }
const cards = ref<StudyCard[]>([]), me = ref<Awaited<ReturnType<typeof studyClient.me>> | null>(null)
const data = ref<StudySnapshot | null>(null), loading = ref(true), busy = ref(false)
const error = ref(''), notice = ref(''), category = ref('all'), currentId = ref(''), flipped = ref(false)
const note = ref(''), savedNote = ref(''), limit = ref(20), legacy = ref(false)
const providers = ref<AuthProvider[]>([])
const mode = ref<'review' | 'free'>('review'), now = ref(Date.now())
const syncUnavailable = ref(false), needsRefresh = ref(false), categoryOpen = ref(false)
const serverNote = ref<string | null>(null)
const pendingReview = ref<{ cardId: string; rating: Rating; expectedVersion: number; requestId: string } | null>(null)
let clock: ReturnType<typeof setInterval> | undefined
const progress = computed(() => new Map((data.value?.progress || []).map(x => [x.cardId, x])))
const notes = computed(() => new Map((data.value?.notes || []).map(x => [x.cardId, x])))
const categories = computed(() => [...new Map(cards.value.map(x => [x.categoryId, x.category]))].map(([id, name]) => ({ id, name })))
const pool = computed(() => category.value === 'all' ? cards.value : cards.value.filter(x => x.categoryId === category.value))
const isNew = (cardId: string) => { const p = progress.value.get(cardId); return !p || p.schedule.reps === 0 || p.schedule.state === 0 }
const queue = computed(() => {
  if (!me.value?.user || !data.value || mode.value === 'free') return pool.value
  const due = pool.value.filter(x => { const p = progress.value.get(x.id); return p && !isNew(x.id) && Date.parse(p.schedule.due) <= now.value })
    .sort((a, b) => Date.parse(progress.value.get(a.id)!.schedule.due) - Date.parse(progress.value.get(b.id)!.schedule.due))
  const available = Math.max(0, data.value.settings.dailyNewLimit - data.value.newCardsStudiedToday)
  return [...due, ...pool.value.filter(x => isNew(x.id)).slice(0, available)]
})
const current = computed(() => cards.value.find(x => x.id === currentId.value))
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
  return { ...c, total: ids.length, unlearned, due, learning, longTerm: ids.length-unlearned-learning }
}))
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
function canLeave() {
  return !noteDirty.value || confirm('当前私人笔记尚未保存，确定放弃修改吗？')
}
function loadCurrentNote() {
  const text = current.value ? notes.value.get(current.value.id)?.text || '' : ''
  note.value = text
  savedNote.value = text
}
function switchCategory(value: string | Event) {
  if (busy.value) return
  const select = value instanceof Event ? value.target as HTMLSelectElement : null
  const next = select?.value || value as string
  if (!canLeave()) { if (select) select.value=category.value; return }
  category.value=next; flipped.value=false
}
function syncCategoryOpen(event: Event) { categoryOpen.value = (event.target as HTMLDetailsElement).open }
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
    await studyClient.review(pendingReview.value, me.value.csrfToken)
    pendingReview.value = null
    flipped.value = false
    try { await refresh(); currentId.value = queue.value.find(x => x.id !== old)?.id || queue.value[0]?.id || '' }
    catch { needsRefresh.value=true; notice.value='评分已保存，但学习数据刷新失败。刷新成功后可继续评分。' }
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
function next(){if(busy.value||!canLeave())return;const i=pool.value.findIndex(x=>x.id===currentId.value);currentId.value=pool.value[(i+1)%pool.value.length]?.id||'';flipped.value=false}
function key(e:KeyboardEvent){const t=e.target as HTMLElement;if(t?.matches('input,textarea,select,button,a,[contenteditable="true"]')||t?.isContentEditable)return;if(e.code==='Space'){e.preventDefault();flipped.value=!flipped.value}else if(flipped.value&&/^[1-4]$/.test(e.key))rate(Number(e.key) as Rating)}
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
  clock = setInterval(() => now.value = Date.now(), 30000)
  categoryOpen.value = window.matchMedia('(min-width: 701px)').matches
  try { legacy.value = !!localStorage.getItem('sby-flashcards-v1') } catch { legacy.value = false }
  try { cards.value = await studyClient.cards(); choose() }
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
  if (clock) clearInterval(clock)
})
</script>

<template><div class="study">
  <div v-if="loading" class="panel empty">正在加载学习卡片…</div><template v-else>
  <div v-if="syncUnavailable" class="banner">同步暂不可用，仍可自由练习。 <button :disabled="busy" @click="manualRefresh">重新连接</button></div>
  <div v-else-if="me && !me.configured" class="banner">学习服务尚未开放。仍可自由练习，但进度不会保存。</div>
  <div v-else-if="!me?.user" class="banner">登录后可同步进度和私人笔记。 <a v-for="provider in providers" :key="provider.id" :href="provider.startUrl" rel="external" target="_self">使用 {{provider.label}} 登录</a></div>
  <div v-if="legacy" class="legacy">旧版自测记录仍保留在本地，不会自动转入新的学习记录。</div>
  <div v-if="error" class="alert">{{error}} <button v-if="!noteDirty" :disabled="busy" @click="manualRefresh">刷新学习数据</button></div><div v-if="notice" class="notice">{{notice}} <button v-if="needsRefresh" :disabled="busy" @click="manualRefresh">立即刷新</button></div>
  <header><span class="identity">{{me?.user ? me.user.login : '自由练习'}}</span><div v-if="me?.user" class="modes"><button :disabled="busy" :class="{active:mode==='review'}" @click="switchMode('review')">正式复习</button><button :disabled="busy" :class="{active:mode==='free'}" @click="switchMode('free')">自由练习</button></div><a v-if="me?.isAdmin" href="/管理/">管理统计</a><span v-if="data" class="today">今日新卡 {{data.newCardsStudiedToday}} / {{data.settings.dailyNewLimit}}</span><button v-if="me?.user" :disabled="busy" @click="logout">退出</button></header>
  <div class="layout"><aside class="panel"><label>学习分类<select :value="category" :disabled="busy" @change="switchCategory($event)"><option value="all">全部分类</option><option v-for="c in categories" :value="c.id">{{c.name}}</option></select></label>
    <details class="category-stats" :open="categoryOpen" @toggle="syncCategoryOpen"><summary>分类学习概况</summary><div>
      <button v-for="s in stats" class="cat" :disabled="busy" :class="{active:category===s.id}" @click="switchCategory(s.id)"><span>{{s.name}}</span><small>未学 {{s.unlearned}} · 到期 {{s.due}}<br>学习中 {{s.learning}} · 长期 {{s.longTerm}}</small></button>
    </div></details>
    <template v-if="data"><label>每日新卡目标<div class="row"><input v-model.number="limit" type="number" min="0" max="100"><button :disabled="busy" @click="settings">保存</button></div></label><button v-if="category!=='all'" class="danger" :disabled="busy" @click="reset">重置当前分类进度</button></template>
  </aside><main><div v-if="!current" class="panel empty">{{me?.user?'当前没有到期卡片或可用新卡。':'这个分类暂无卡片。'}}</div><template v-else>
    <div class="meta"><span>{{current.category}}</span><span>{{mode==='review'?`待复习 ${queue.length} 张`:'自由练习'}}</span></div>
    <button class="card" :class="{flipped}" @click="flipped=!flipped"><small>{{flipped?'答案':'问题'}}</small><span>{{flipped?current.answer:current.question}}</span><em>{{flipped?'请按实际回忆情况评分':'点击或按空格查看答案'}}</em></button>
    <div v-if="me?.user&&mode==='review'" class="ratings"><button v-for="r in ([1,2,3,4] as Rating[])" :disabled="needsRefresh||!flipped||busy" @click="rate(r)"><b>{{ratingNames[r]}}</b><small>{{intervals?interval(intervals[r].due):'—'}}</small><kbd>{{r}}</kbd></button></div><div v-else class="next"><button :disabled="busy" @click="next">下一张</button></div>
    <p class="estimate">下次间隔为调度估算，并不代表记忆能保持的真实时长。</p><div class="links"><a :href="current.noteUrl">查看原笔记</a><a :href="current.sourceUrl">{{current.sourceTitle||'查看来源'}}</a></div>
    <section v-if="data" class="panel notes"><h2>私人笔记</h2><textarea v-model="note" :disabled="busy" rows="5" placeholder="纯文本，仅自己可见"></textarea><div v-if="serverNote!==null" class="server-note"><b>服务端最新版本（只读）</b><pre>{{serverNote || '（空笔记）'}}</pre></div><button :disabled="busy" @click="saveNote">{{serverNote!==null?'保存合并后的笔记':'保存笔记'}}</button></section>
  </template></main></div>
  <section v-if="data" class="panel history"><h2>当前分类复习历史</h2><p v-if="!history.length">暂无复习记录</p><ul><li v-for="h in history" :key="h.id"><span>{{cards.find(c=>c.id===h.cardId)?.question||h.cardId}}</span><b>{{ratingNames[h.rating]}}</b><time>{{new Date(h.reviewedAt).toLocaleString('zh-CN')}}</time></li></ul></section>
  </template></div></template>

<style scoped>
.study{max-width:980px;min-width:0;margin:auto;color:var(--sby-text-1,var(--vp-c-text-1))}.panel{background:var(--sby-bg-card,var(--vp-c-bg-soft));border:1px solid var(--sby-border,var(--vp-c-divider));border-radius:14px}.banner,.legacy,.alert,.notice{padding:12px 15px;margin-bottom:12px;border-radius:9px;background:var(--vp-c-brand-soft);font-size:14px;overflow-wrap:anywhere}.legacy{background:var(--vp-c-bg-soft);color:var(--vp-c-text-2)}.alert{background:var(--vp-c-danger-soft);color:var(--vp-c-danger-1)}header,.row,.meta,.links,.modes{display:flex;align-items:center;gap:12px}header{margin:12px 0;flex-wrap:wrap}.identity{font-weight:600}.today{margin-left:auto;color:var(--vp-c-text-2)}.modes{gap:3px;padding:3px;background:var(--vp-c-bg-soft);border-radius:9px}.modes button{border:0;background:none;padding:7px 9px;border-radius:6px}.modes button.active{background:var(--vp-c-bg);color:var(--vp-c-brand-1)}button,select,input,textarea{font:inherit;color:inherit}.layout{display:grid;grid-template-columns:240px minmax(0,1fr);gap:22px}.layout>main{min-width:0}aside{padding:15px;align-self:start}label{display:block;font-size:12px;color:var(--vp-c-text-2);margin-bottom:14px}select,input,textarea{box-sizing:border-box;width:100%;padding:8px;border:1px solid var(--vp-c-divider);border-radius:8px;background:var(--vp-c-bg)}.category-stats summary{margin-bottom:6px;font-size:12px;color:var(--vp-c-text-2);cursor:pointer}.cat{display:flex;width:100%;align-items:flex-start;justify-content:space-between;gap:6px;border:0;border-radius:7px;padding:8px;background:none;text-align:left}.cat small{text-align:right;color:var(--vp-c-text-3);font-size:10px;line-height:1.5;white-space:nowrap}.cat.active,.cat:hover{background:var(--vp-c-brand-soft)}.danger{border:0;background:none;color:var(--vp-c-danger-1)}.meta,.links{justify-content:space-between;font-size:13px;color:var(--vp-c-text-2);margin:0 2px 10px}.links{flex-wrap:wrap}.links a{overflow-wrap:anywhere}.card{width:100%;min-height:310px;padding:28px;display:flex;flex-direction:column;text-align:left;border:1px solid var(--vp-c-divider);border-radius:18px;background:var(--sby-bg-card,var(--vp-c-bg-soft));overflow-wrap:anywhere}.card.flipped{border-color:var(--vp-c-brand-1)}.card>small{color:var(--vp-c-brand-1)}.card>span{margin:auto 0;font-size:20px;line-height:1.75;white-space:pre-wrap}.card>em{font-size:12px;color:var(--vp-c-text-3);font-style:normal}.ratings{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:12px}.ratings button{position:relative;min-height:44px;padding:9px;border:1px solid var(--vp-c-divider);border-radius:9px;background:var(--vp-c-bg-soft)}.ratings button>*{display:block}.ratings kbd{position:absolute;right:6px;top:5px}.next{text-align:right;margin-top:12px}.next button,.notes button{min-height:44px}.estimate{text-align:center;font-size:12px;color:var(--vp-c-text-3)}.notes,.history{padding:16px;margin-top:20px;min-width:0}.notes h2,.history h2{font-size:16px;margin:0 0 10px}.notes textarea{resize:vertical}.server-note{margin:8px 0;padding:10px;border-left:3px solid var(--vp-c-warning-1);background:var(--vp-c-bg)}.server-note b{font-size:12px}.server-note pre{margin:6px 0 0;white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;color:var(--vp-c-text-2)}.history ul{list-style:none;padding:0}.history li{display:grid;grid-template-columns:minmax(0,1fr) 50px 150px;gap:10px;border-top:1px solid var(--vp-c-divider);padding:8px;font-size:13px}.history li span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.empty{padding:35px;text-align:center}
@media(max-width:700px){header{align-items:center;margin:8px 0}.identity{max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.today{margin-left:0;order:3;font-size:12px}.modes{flex:1}.modes button{flex:1;min-height:44px}.layout{grid-template-columns:minmax(0,1fr);gap:14px}aside{padding:12px}aside>label{margin-bottom:0}.category-stats{margin-top:10px}.category-stats:not([open])>div{display:none}.card{min-height:240px;padding:20px}.ratings{grid-template-columns:repeat(2,minmax(0,1fr))}.ratings button{min-height:52px}.history li{grid-template-columns:minmax(0,1fr) 45px}.history time{display:none}.links{align-items:flex-start;flex-direction:column;gap:5px}}
@media(max-width:380px){.study{font-size:14px}.banner,.legacy,.alert,.notice{padding:10px}.card{min-height:220px;padding:16px}.card>span{font-size:18px}.notes,.history{padding:12px}.meta{gap:6px}.meta span:last-child{white-space:nowrap}}
@media(max-height:500px) and (orientation:landscape){.card{min-height:180px}.category-stats{display:none}.layout{gap:10px}}
</style>
