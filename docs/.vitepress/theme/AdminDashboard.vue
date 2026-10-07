<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { studyClient, type AdminStats, type AdminUsersPage, type AuthProvider } from './study/client'

const me = ref<Awaited<ReturnType<typeof studyClient.me>> | null>(null)
const providers = ref<AuthProvider[]>([])
const stats = ref<AdminStats | null>(null)
const usersPage = ref<AdminUsersPage | null>(null)
const loading = ref(true)
const pageLoading = ref(false)
const error = ref('')

const totalPages = computed(() => usersPage.value ? Math.max(1, Math.ceil(usersPage.value.total / usersPage.value.pageSize)) : 1)

function formatDate(value: string | null) {
  if (!value) return '从未登录'
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date.toLocaleString('zh-CN') : '—'
}

async function loadPage(page: number) {
  if (!me.value?.isAdmin || pageLoading.value || page < 1 || page > totalPages.value) return
  pageLoading.value = true
  error.value = ''
  try { usersPage.value = await studyClient.adminUsers(page) }
  catch (cause) { error.value = cause instanceof Error ? cause.message : String(cause) }
  finally { pageLoading.value = false }
}

async function loadAdmin() {
  error.value = ''
  try {
    const [summary, firstPage] = await Promise.all([studyClient.adminStats(), studyClient.adminUsers(1)])
    stats.value = summary
    usersPage.value = firstPage
  } catch (cause) { error.value = cause instanceof Error ? cause.message : String(cause) }
}

onMounted(async () => {
  try {
    const [identity, auth] = await Promise.all([studyClient.me(), studyClient.providers()])
    me.value = identity
    providers.value = auth.providers.filter(provider => provider.enabled)
    if (identity.isAdmin) await loadAdmin()
  } catch (cause) { error.value = cause instanceof Error ? cause.message : String(cause) }
  finally { loading.value = false }
})
</script>

<template>
  <div class="admin">
    <div v-if="loading" class="state">正在确认访问权限…</div>
    <div v-else-if="!me?.user" class="state">
      <h2>请先登录</h2>
      <p>管理统计仅向管理员开放。</p>
      <a v-for="provider in providers" :key="provider.id" class="login" :href="provider.startUrl" rel="external" target="_self">使用 {{provider.label}} 登录</a>
    </div>
    <div v-else-if="!me.isAdmin" class="state denied" role="alert">
      <h2>无权访问</h2>
      <p>当前账户不是管理员，无法查看本站的私有统计。</p>
      <a href="/自测/">返回学习中心</a>
    </div>
    <template v-else>
      <div v-if="error" class="error" role="alert">{{error}} <button @click="loadAdmin">重试</button></div>
      <section v-if="stats" class="metrics" aria-label="统计概览">
        <article><span>用户总数</span><strong>{{stats.totalUsers}}</strong></article>
        <article><span>登录总次数</span><strong>{{stats.totalSignIns}}</strong></article>
        <article><span>近 7 天活跃用户</span><strong>{{stats.activeUsers7d}}</strong></article>
        <article><span>近 30 天活跃用户</span><strong>{{stats.activeUsers30d}}</strong></article>
      </section>

      <section v-if="stats" class="panel daily">
        <h2>每日登录</h2>
        <div v-if="!stats.dailyLogins.length" class="muted">暂无登录记录</div>
        <ul v-else>
          <li v-for="day in stats.dailyLogins" :key="day.date"><time>{{day.date}}</time><span>{{day.signIns}} 次登录</span><span>{{day.users}} 位用户</span></li>
        </ul>
      </section>

      <section v-if="usersPage" class="panel users">
        <div class="section-head"><h2>登录用户</h2><span>共 {{usersPage.total}} 人</span></div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>用户</th><th>加入时间</th><th>最近登录</th><th>登录次数</th></tr></thead>
            <tbody><tr v-for="user in usersPage.users" :key="user.id"><td>{{user.login}}</td><td>{{formatDate(user.createdAt)}}</td><td>{{formatDate(user.lastLoginAt)}}</td><td>{{user.signIns}}</td></tr></tbody>
          </table>
        </div>
        <div class="pager"><button :disabled="pageLoading||usersPage.page<=1" @click="loadPage(usersPage.page-1)">上一页</button><span>第 {{usersPage.page}} / {{totalPages}} 页</span><button :disabled="pageLoading||usersPage.page>=totalPages" @click="loadPage(usersPage.page+1)">下一页</button></div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.admin{max-width:980px;min-width:0;margin:0 auto;color:var(--sby-text-1,var(--vp-c-text-1))}.state,.panel,.metrics article,.error{border:1px solid var(--sby-border,var(--vp-c-divider));border-radius:14px;background:var(--sby-bg-card,var(--vp-c-bg-soft))}.state{padding:36px;text-align:center}.state h2{margin:0 0 8px;font-size:20px}.state p,.muted{color:var(--vp-c-text-2)}.login{display:inline-block;margin:8px 4px 0;padding:9px 14px;border-radius:8px;background:var(--vp-c-brand-1);color:#fff;text-decoration:none}.denied{border-color:var(--vp-c-danger-soft)}.error{margin-bottom:16px;padding:12px 15px;color:var(--vp-c-danger-1)}.error button{margin-left:8px}.metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.metrics article{padding:18px}.metrics span{display:block;color:var(--vp-c-text-2);font-size:13px}.metrics strong{display:block;margin-top:7px;font-size:28px;font-variant-numeric:tabular-nums}.panel{margin-top:18px;padding:18px}.panel h2{margin:0;font-size:17px}.daily ul{list-style:none;margin:12px 0 0;padding:0}.daily li{display:grid;grid-template-columns:minmax(110px,1fr) 1fr 1fr;gap:12px;padding:9px 0;border-top:1px solid var(--vp-c-divider);font-size:14px}.daily li span{color:var(--vp-c-text-2)}.section-head,.pager{display:flex;align-items:center;justify-content:space-between;gap:12px}.section-head>span{color:var(--vp-c-text-2);font-size:13px}.table-wrap{max-width:100%;overflow-x:auto;margin-top:12px}.users table{width:100%;min-width:640px;border-collapse:collapse;font-size:14px}.users th,.users td{padding:10px;text-align:left;border-top:1px solid var(--vp-c-divider)}.users th{color:var(--vp-c-text-2);font-weight:600}.users td:first-child{font-weight:600;overflow-wrap:anywhere}.pager{justify-content:center;margin-top:14px}.pager button,.error button{min-height:40px;padding:7px 12px;border:1px solid var(--vp-c-divider);border-radius:8px;background:var(--vp-c-bg);color:var(--vp-c-text-1)}.pager button:disabled{opacity:.45}
@media(max-width:700px){.metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.metrics article{padding:14px}.metrics strong{font-size:24px}.panel{padding:14px}.daily li{grid-template-columns:1fr 1fr}.daily li span:last-child{grid-column:2}.table-wrap{overflow:visible}.users table,.users tbody,.users tr,.users td{display:block;min-width:0}.users thead{display:none}.users tr{padding:10px 0;border-top:1px solid var(--vp-c-divider)}.users td{display:grid;grid-template-columns:90px minmax(0,1fr);gap:8px;padding:4px 0;border:0}.users td::before{color:var(--vp-c-text-3);font-size:12px}.users td:nth-child(1)::before{content:'用户'}.users td:nth-child(2)::before{content:'加入时间'}.users td:nth-child(3)::before{content:'最近登录'}.users td:nth-child(4)::before{content:'登录次数'}}
@media(max-width:360px){.metrics{grid-template-columns:1fr}.state{padding:24px 14px}.daily li{grid-template-columns:1fr}.daily li span:last-child{grid-column:auto}.pager{flex-wrap:wrap}}
</style>
