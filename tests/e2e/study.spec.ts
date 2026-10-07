import { expect, test, type Page } from '@playwright/test'

async function openStudy(page: Page) {
  await page.goto('/自测/')
  await expect(page.locator('.study .card')).toBeVisible()
}

async function login(page: Page) {
  await openStudy(page)
  await page.getByRole('link', { name: '使用 GitHub 登录' }).click()
  await expect(page.getByRole('button', { name: '正式复习' })).toBeVisible()
}

const question = (page: Page) => page.locator('.card > span')

test('主学习入口使用原药卡字段并保留该药旧记录', async ({ page, request }) => {
  const original = await (await request.get('/flashcards.json')).json()
  const cards = await (await request.get('/study-cards.json')).json()
  expect(cards).toHaveLength(original.length)
  expect(cards.every((card: any) => card.kind === 'herb' && card.status === 'unverified')).toBe(true)
  const first = cards[0]
  const source = original.find((card: any) => card.url === first.noteUrl)
  expect(first.herb).toEqual({ name: source.name, chapter: source.chapter, subsection: source.subsection, suji: source.suji, xingwei: source.xingwei, guijing: source.guijing, gongxiao: source.gongxiao, zhuzhi: source.zhuzhi })
  await page.addInitScript(({ name }) => localStorage.setItem('sby-flashcards-v1', JSON.stringify({ [name]: 'know' })), { name: source.name })
  await openStudy(page)
  await expect(question(page)).toHaveText(source.name)
  await expect(page.locator('.old-status')).toHaveText('旧记录：认识')
  await page.locator('.card').click()
  await expect(page.locator('.herb-suji')).toHaveText(source.suji)
  await expect(question(page)).toContainText(source.xingwei)
  await expect(question(page)).toContainText(source.guijing)
  for (const value of [...source.gongxiao, ...source.zhuzhi]) await expect(question(page)).toContainText(value)
  await expect(page.locator('.provenance')).toHaveText('原有笔记 · 待核对')
  expect(await page.evaluate(name => JSON.parse(localStorage.getItem('sby-flashcards-v1')!)[name], source.name)).toBe('know')
})

test('游客可以自由练习且不会写入复习进度', async ({ page }) => {
  let reviewWrites = 0
  await page.route('**/api/study/reviews', route => {
    reviewWrites++
    return route.continue()
  })
  await openStudy(page)
  await expect(page.locator('.study .identity')).toHaveText('自由练习')
  const first = await question(page).textContent()
  await page.locator('.card').click()
  await expect(page.locator('.card > small')).toHaveText('药卡')
  await page.getByRole('button', { name: '下一张' }).click()
  await expect(question(page)).not.toHaveText(first || '')
  expect(reviewWrites).toBe(0)
})

test('自由练习的记住了和还要练保存本机记录并保留其他药物', async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('sby-flashcards-v1')) localStorage.setItem('sby-flashcards-v1', JSON.stringify({ '既有药物': 'unknown' }))
  })
  await openStudy(page)
  const name = (await question(page).textContent())!
  await page.getByRole('button', { name: '记住了', exact: true }).click()
  const records = await page.evaluate(() => JSON.parse(localStorage.getItem('sby-flashcards-v1')!))
  expect(records[name]).toBe('know')
  expect(records['既有药物']).toBe('unknown')
  await page.reload()
  await expect(question(page)).toHaveText(name)
  await expect(page.locator('.old-status')).toHaveText('旧记录：认识')
  await page.getByRole('button', { name: '还要练', exact: true }).click()
  expect(await page.evaluate(value => JSON.parse(localStorage.getItem('sby-flashcards-v1')!)[value], name)).toBe('unknown')
})

test('仅看未掌握时标记记住了进入紧邻下一张且章节默认收起', async ({ page }) => {
  await openStudy(page)
  const chapters = page.locator('details.chapter')
  expect(await chapters.count()).toBeGreaterThan(1)
  expect(await chapters.evaluateAll(items => items.every(item => !(item as HTMLDetailsElement).open))).toBe(true)
  await page.getByLabel('仅看未掌握').check()
  const first = await question(page).textContent()
  await page.getByRole('button', { name: '下一张' }).click()
  const second = await question(page).textContent()
  await page.getByRole('button', { name: '上一张' }).click()
  await expect(question(page)).toHaveText(first || '')
  await page.getByRole('button', { name: '记住了', exact: true }).click()
  await expect(question(page)).toHaveText(second || '')
})

test('登录后必须翻面才能评分，并可用键盘完成复习', async ({ page }) => {
  await login(page)
  const first = await question(page).textContent()
  await expect(page.getByRole('button', { name: /记住了/ })).toBeDisabled()
  await page.locator('body').press('Space')
  await expect(page.locator('.card > small')).toHaveText('药卡')
  const response = page.waitForResponse(res => res.url().includes('/api/study/reviews') && res.request().method() === 'POST')
  await page.locator('body').press('3')
  expect((await response).ok()).toBeTruthy()
  await expect(question(page)).not.toHaveText(first || '')

  await page.getByRole('button', { name: '自由练习' }).click()
  await page.locator('.card').click()
  await page.getByRole('button', { name: '下一张' }).focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('.card > small')).toHaveText('回忆')
})

test('私人笔记保存后刷新仍恢复，退出后不再显示', async ({ page }) => {
  await login(page)
  const text = `只属于当前用户的笔记 ${Date.now()}`
  await page.locator('.notes textarea').fill(text)
  await page.getByRole('button', { name: '保存笔记' }).click()
  await expect(page.getByText('私人笔记已保存')).toBeVisible()
  await page.reload()
  await expect(page.locator('.notes textarea')).toHaveValue(text)
  await page.getByRole('button', { name: '退出' }).click()
  await expect(page.getByRole('link', { name: '使用 GitHub 登录' })).toBeVisible()
  await expect(page.locator('.notes')).toHaveCount(0)
  await expect(page.getByText(text)).toHaveCount(0)
})

test('重置分类进度会保留笔记和复习历史', async ({ page }) => {
  await login(page)
  await page.locator('.chapter').first().locator('summary').click()
  await page.locator('.chapter').first().locator('.cat').click()
  const text = `重置后保留 ${Date.now()}`
  await page.locator('.notes textarea').fill(text)
  await page.getByRole('button', { name: '保存笔记' }).click()
  await page.locator('.card').click()
  await page.getByRole('button', { name: /记住了/ }).click()
  await expect(page.locator('.history li')).toHaveCount(1)
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: '重置当前分类进度' }).click()
  await expect(page.getByText('已重置当前分类进度')).toBeVisible()
  const snapshot = await (await page.request.get('/api/study')).json()
  expect(snapshot.notes.some((item: { text: string }) => item.text === text)).toBeTruthy()
  expect(snapshot.reviews.length).toBeGreaterThan(0)
  await expect(page.locator('.history li')).not.toHaveCount(0)
})

test('冲突和网络失败时保留当前卡片与笔记', async ({ page }) => {
  await login(page)
  const originalQuestion = await question(page).textContent()
  const draft = `尚未丢失的草稿 ${Date.now()}`
  await page.route('**/api/study/notes', route => route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: '版本冲突' }) }))
  await page.locator('.notes textarea').fill(draft)
  await page.getByRole('button', { name: '保存笔记' }).click()
  await expect(page.locator('.alert')).toContainText('草稿已保留')
  await expect(page.locator('.notes textarea')).toHaveValue(draft)
  await expect(page.getByText('服务端最新版本（只读）')).toBeVisible()
  await expect(page.getByRole('button', { name: '保存合并后的笔记' })).toBeVisible()
  await expect(question(page)).toHaveText(originalQuestion || '')

  await page.unroute('**/api/study/notes')
  await page.getByRole('button', { name: '保存合并后的笔记' }).click()
  await expect(page.getByText('私人笔记已保存')).toBeVisible()
  await page.route('**/api/study/reviews', route => route.abort('connectionfailed'))
  await page.locator('.card').click()
  const originalAnswer = await question(page).textContent()
  await page.getByRole('button', { name: /记住了/ }).click()
  await expect(page.locator('.alert')).toBeVisible()
  await expect(question(page)).toHaveText(originalAnswer || '')
  await page.locator('.card').click()
  await expect(question(page)).toHaveText(originalQuestion || '')
  await expect(page.locator('.notes textarea')).toHaveValue(draft)
})

test('评分已保存但刷新失败时锁定评分，刷新成功后恢复', async ({ page }) => {
  await login(page)
  await page.route('**/api/study', route => route.abort('connectionfailed'))
  await page.locator('.card').click()
  await page.getByRole('button', { name: /记住了/ }).click()
  await expect(page.getByText('评分已保存，但学习数据刷新失败')).toBeVisible()
  await expect(page.getByRole('button', { name: /记住了/ })).toBeDisabled()
  await expect(page.getByRole('button', { name: '立即刷新' })).toBeVisible()
  await page.unroute('**/api/study')
  await page.getByRole('button', { name: '立即刷新' }).click()
  await expect(page.getByText('学习数据已刷新')).toBeVisible()
})

test('同步接口故障时仍加载静态卡片并可自由练习', async ({ page }) => {
  await page.route('**/api/me', route => route.abort('connectionfailed'))
  await page.route('**/api/auth/providers', route => route.abort('connectionfailed'))
  await openStudy(page)
  await expect(page.getByText('同步暂不可用')).toBeVisible()
  await expect(page.locator('.card')).toBeVisible()
  await page.locator('.card').click()
  await expect(page.locator('.card > small')).toHaveText('药卡')
})

for (const width of [320, 360, 390, 430]) {
  test(`手机 ${width}px 宽度无横向溢出`, async ({ page }) => {
    await page.setViewportSize({ width, height: 740 })
    await openStudy(page)
    const dimensions = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }))
    expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client)
    await expect(page.locator('.card')).toBeInViewport()
  })
}

test('手机横屏仍可操作卡片和分类', async ({ page }) => {
  await page.setViewportSize({ width: 667, height: 375 })
  await openStudy(page)
  await expect(page.locator('.study select')).toBeVisible()
  await expect(page.locator('.card')).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(0)
})
