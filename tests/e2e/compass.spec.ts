import { expect, test } from '@playwright/test'

const mansionNames = [
  '角', '亢', '氐', '房', '心', '尾', '箕',
  '斗', '牛', '女', '虚', '危', '室', '壁',
  '奎', '娄', '胃', '昴', '毕', '觜', '参',
  '井', '鬼', '柳', '星', '张', '翼', '轸',
]

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('constellation-dial')).toBeVisible()
})

test('renders all mansions and real classic-book destinations', async ({ page, request }) => {
  const mansionButtons = page.getByTestId('mansion-button')
  await expect(mansionButtons).toHaveCount(28)
  await expect(mansionButtons.first()).toHaveAttribute('data-name', mansionNames[0])
  await expect(mansionButtons.first()).not.toHaveAttribute('role', 'button')
  expect(await mansionButtons.evaluateAll((items) => items.map((item) => item.getAttribute('data-name')))).toEqual(mansionNames)
  await expect(page.getByTestId('quadrant-tab')).toHaveCount(4)

  const links = page.getByTestId('book-link')
  await expect(links).toHaveCount(4)
  const hrefs = await links.evaluateAll((items) => items.map((item) => item.getAttribute('href')))
  expect(hrefs).toEqual([
    '/四大经典/黄帝内经/',
    '/四大经典/伤寒论/',
    '/四大经典/金匮要略/',
    '/四大经典/神农本草经/',
  ])

  for (const href of hrefs) {
    const response = await request.get(new URL(href!, page.url()).toString())
    expect(response.status(), href!).toBeLessThan(400)
  }
})

test('applies distinct light and dark instrument palettes', async ({ page }) => {
  const palette = () => page.locator('.constellation').evaluate((element) => ({
    panel: getComputedStyle(element).getPropertyValue('--instrument-bg').trim(),
    color: getComputedStyle(element).color,
  }))

  await page.evaluate(() => document.documentElement.classList.remove('dark'))
  const light = await palette()
  await page.evaluate(() => document.documentElement.classList.add('dark'))
  const dark = await palette()

  expect(light.panel).toContain('245, 249, 255')
  expect(dark.panel).toContain('8, 18, 31')
  expect(dark).not.toEqual(light)
})

test('supports click, keyboard selection, reset, and drag without a stray click', async ({ page }) => {
  await page.locator('[data-testid="mansion-button"][data-name="房"]').click()
  await expect(page.locator('.selected-name strong')).toHaveText('房')

  const dial = page.getByTestId('constellation-dial')
  await dial.focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.locator('.selected-name strong')).toHaveText('心')
  await page.keyboard.press('Home')
  await expect(page.locator('.selected-name strong')).toHaveText('角')

  const box = await dial.boundingBox()
  expect(box).not.toBeNull()
  const centerX = box!.x + box!.width / 2
  const centerY = box!.y + box!.height / 2
  const radius = box!.width * 0.36
  await page.mouse.move(centerX + radius, centerY)
  await page.mouse.down()
  await page.mouse.move(centerX, centerY + radius, { steps: 10 })
  await page.mouse.up()

  // A clockwise quarter-turn selects the first southern mansion. The pointer
  // starts over another mansion, so this also protects against post-drag click.
  await expect(page.locator('.selected-name strong')).toHaveText('井')
})

for (const width of [320, 390]) {
  test(`fits a ${width}px touch viewport and responds to a touch-style drag`, async ({ page }) => {
    await page.setViewportSize({ width, height: 760 })
    await page.reload()

    const dial = page.getByTestId('constellation-dial')
    await expect(dial).toBeVisible()
    await expect(dial).toHaveCSS('touch-action', 'none')
    await expect(page.getByTestId('mansion-button')).toHaveCount(28)
    await expect(page.getByTestId('quadrant-tab')).toHaveCount(4)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)

    const box = await dial.boundingBox()
    expect(box).not.toBeNull()
    const centerX = box!.x + box!.width / 2
    const centerY = box!.y + box!.height / 2
    const radius = box!.width * 0.34
    await dial.dispatchEvent('pointerdown', { pointerId: 17, pointerType: 'touch', button: 0, clientX: centerX + radius, clientY: centerY })
    await dial.dispatchEvent('pointermove', { pointerId: 17, pointerType: 'touch', button: 0, clientX: centerX, clientY: centerY + radius })
    await dial.dispatchEvent('pointerup', { pointerId: 17, pointerType: 'touch', button: 0, clientX: centerX, clientY: centerY + radius })
    await expect(page.locator('.selected-name strong')).toHaveText('井')

    const fullList = page.getByTestId('mansion-list')
    await fullList.locator('summary').click()
    await expect(fullList.locator('button')).toHaveCount(28)
    for (const name of mansionNames) await expect(fullList.getByRole('button', { name, exact: true })).toHaveCount(1)
  })
}

test('landscape mobile layout has no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 760, height: 390 })
  await page.reload()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  await expect(page.getByTestId('constellation-dial')).toBeVisible()
})
