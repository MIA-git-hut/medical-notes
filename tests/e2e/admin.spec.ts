import { expect, test, type Page, type Route } from '@playwright/test'

const json = (route: Route, body: unknown) => route.fulfill({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify(body),
})

async function mockProviders(page: Page) {
  await page.route('**/api/auth/providers', route => json(route, {
    providers: [{ id: 'github', label: 'GitHub', kind: 'oauth2', enabled: true, startUrl: '/api/auth/github' }],
  }))
}

test('游客只看到登录提示和已启用的登录入口', async ({ page }) => {
  await mockProviders(page)
  await page.route('**/api/me', route => json(route, { user: null, configured: true, isAdmin: false }))

  await page.goto('/管理/')

  await expect(page.getByRole('heading', { name: '请先登录' })).toBeVisible()
  await expect(page.getByText('管理统计仅向管理员开放。')).toBeVisible()
  await expect(page.getByRole('link', { name: '使用 GitHub 登录' })).toHaveAttribute('href', '/api/auth/github')
  await expect(page.getByRole('region', { name: '统计概览' })).toHaveCount(0)
})

test('普通用户显示拒绝状态且不发起任何管理员接口请求', async ({ page }) => {
  const privilegedRequests: string[] = []
  await mockProviders(page)
  await page.route('**/api/me', route => json(route, {
    user: { id: 'user-1', login: 'reader', avatarUrl: '' },
    configured: true,
    isAdmin: false,
  }))
  await page.route('**/api/admin/**', route => {
    privilegedRequests.push(route.request().url())
    return route.abort('blockedbyclient')
  })

  await page.goto('/管理/')

  await expect(page.getByRole('alert')).toContainText('无权访问')
  await expect(page.getByText('当前账户不是管理员，无法查看本站的私有统计。')).toBeVisible()
  await expect(page.getByRole('link', { name: '返回学习中心' })).toHaveAttribute('href', '/自测/')
  await expect(page.getByText('用户总数')).toHaveCount(0)
  expect(privilegedRequests).toEqual([])
})

test('管理员可以查看统计概览、每日登录和用户列表', async ({ page }) => {
  await mockProviders(page)
  await page.route('**/api/me', route => json(route, {
    user: { id: 'admin-1', login: 'site-admin', avatarUrl: '' },
    configured: true,
    isAdmin: true,
  }))
  await page.route('**/api/admin/stats', route => json(route, {
    totalUsers: 42,
    totalSignIns: 137,
    activeUsers7d: 9,
    activeUsers30d: 24,
    dailyLogins: [{ date: '2026-10-06', signIns: 7, users: 5 }],
  }))
  await page.route('**/api/admin/users?page=1', route => json(route, {
    users: [
      { id: 'user-2', login: 'alice', createdAt: '2026-09-01T00:00:00.000Z', lastLoginAt: '2026-10-06T08:30:00.000Z', signIns: 12 },
      { id: 'user-3', login: 'never-signed-in', createdAt: '2026-10-01T00:00:00.000Z', lastLoginAt: null, signIns: 0 },
    ],
    page: 1,
    pageSize: 50,
    total: 2,
  }))

  await page.goto('/管理/')

  const metrics = page.getByRole('region', { name: '统计概览' })
  await expect(metrics).toContainText('用户总数42')
  await expect(metrics).toContainText('登录总次数137')
  await expect(metrics).toContainText('近 7 天活跃用户9')
  await expect(metrics).toContainText('近 30 天活跃用户24')
  await expect(page.getByRole('heading', { name: '每日登录' })).toBeVisible()
  await expect(page.getByText('7 次登录')).toBeVisible()
  await expect(page.getByText('5 位用户')).toBeVisible()

  const rows = page.getByRole('table').getByRole('row')
  await expect(rows).toHaveCount(3)
  await expect(rows.nth(1)).toContainText('alice')
  await expect(rows.nth(1)).toContainText('12')
  await expect(rows.nth(2)).toContainText('never-signed-in')
  await expect(rows.nth(2)).toContainText('从未登录')
  await expect(page.getByText('共 2 人')).toBeVisible()
  await expect(page.getByText('第 1 / 1 页')).toBeVisible()
})
