import { expect, test, type Page } from '@playwright/test'

const mansionNames = ['角','亢','氐','房','心','尾','箕','斗','牛','女','虚','危','室','壁','奎','娄','胃','昴','毕','觜','参','井','鬼','柳','星','张','翼','轸']

async function openHome(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await expect(page.getByTestId('constellation-dial')).toBeVisible()
}

test('renders all 28 mansions and real study destinations', async ({ page, request }) => {
  await openHome(page)
  const mansions = page.getByTestId('mansion-button')
  await expect(mansions).toHaveCount(28)
  expect(await mansions.evaluateAll(items => items.map(item => item.getAttribute('data-name')))).toEqual(mansionNames)
  const hrefs = await page.locator('.entries a[href]').evaluateAll(items => items.map(item => item.getAttribute('href')))
  expect(hrefs).toEqual(['/中药学/','/四大经典/黄帝内经/','/四大经典/伤寒论/','/四大经典/金匮要略/','/四大经典/神农本草经/'])
  for (const href of hrefs) {
    const response = await request.get(new URL(href!, page.url()).toString())
    expect(response.status(), href!).toBeLessThan(400)
  }
})

test('keeps the centered hero readable and its links and search interactive', async ({ page }) => {
  await openHome(page)
  const hero = page.locator('.celestial-stage .hero')
  const title = hero.locator('.hero-title')
  await expect(title).toHaveText('溯本医源')
  const titleBox = await title.boundingBox()
  const viewport = page.viewportSize()!
  expect(titleBox).not.toBeNull()
  expect(Math.abs(titleBox!.x + titleBox!.width / 2 - viewport.width / 2)).toBeLessThan(30)
  const search = hero.locator('.hs-input')
  await search.click()
  await expect(search).toBeFocused()
  await search.fill('甘草')
  await expect(search).toHaveValue('甘草')
  await search.press('Escape')
  await hero.locator('.hero-actions a').first().click()
  await expect(page).toHaveURL(/%E4%B8%AD%E8%8D%AF%E5%AD%A6|中药学/)
})

test('uses distinct light and dark orbit palettes', async ({ page }) => {
  await openHome(page)
  const palette = () => page.locator('.celestial-orbit').evaluate(element => ({
    cyan: getComputedStyle(element).getPropertyValue('--orbit-cyan').trim(),
    gold: getComputedStyle(element).getPropertyValue('--orbit-gold').trim(),
  }))
  await page.evaluate(() => document.documentElement.classList.remove('dark'))
  const light = await palette()
  await page.evaluate(() => document.documentElement.classList.add('dark'))
  const dark = await palette()
  expect(light.cyan).toBe('#376f88')
  expect(dark.cyan).toBe('#89d8ee')
  expect(dark).not.toEqual(light)
})

test('restores all four beasts and magnifies entire sectors at the side focus', async ({ page }) => {
  await openHome(page)
  await expect(page.locator('.orbital-beast')).toHaveCount(4)
  expect(await page.locator('.orbital-beast').evaluateAll(items => items.map(item => item.getAttribute('data-beast')))).toEqual(['east', 'north', 'west', 'south'])
  const mansion = page.locator('[data-name="角"]')
  const focused = await mansion.getAttribute('transform')
  expect(focused).toContain('scale(1.7)')
  await page.getByTestId('constellation-dial').focus()
  for (let index = 0; index < 7; index++) await page.keyboard.press('ArrowRight')
  const distant = await mansion.getAttribute('transform')
  expect(distant).toContain('scale(1)')
  expect(await page.locator('.celestial-orbit').evaluate(el => getComputedStyle(el).maskImage)).toContain('linear-gradient')
  await expect(page.locator('.ticks .major')).toHaveCount(28)
})

test('supports click and keyboard selection with the central readout', async ({ page }) => {
  await openHome(page)
  await page.locator('[data-testid="mansion-button"][data-name="房"]').click()
  await expect(page.locator('.orbit-selection b')).toHaveText('房宿')
  await expect(page.locator('.orbit-count')).toHaveText('04 / 28')
  const dial = page.getByTestId('constellation-dial')
  await dial.focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.locator('.orbit-selection b')).toHaveText('心宿')
  await page.keyboard.press('Home')
  await expect(page.locator('.orbit-selection b')).toHaveText('角宿')
  await page.keyboard.press('End')
  await expect(page.locator('.orbit-selection b')).toHaveText('轸宿')
})

test('drag rotates continuously before release and then settles', async ({ page }) => {
  await openHome(page)
  const dial = page.getByTestId('constellation-dial')
  const svg = dial.locator('svg')
  const wheel = svg.locator('.wheel-graphics')
  const box = await svg.boundingBox()
  expect(box).not.toBeNull()
  const x = box!.x + box!.width / 2, y = box!.y + box!.height / 2, radius = box!.width * .4
  const initial = await wheel.getAttribute('transform')
  await svg.dispatchEvent('pointerdown', { pointerId: 8, pointerType: 'mouse', button: 0, clientX: x + radius, clientY: y })
  await svg.dispatchEvent('pointermove', { pointerId: 8, pointerType: 'mouse', button: 0, clientX: x + radius * .7, clientY: y + radius * .7 })
  expect(await wheel.getAttribute('transform')).not.toBe(initial)
  await expect(dial).toHaveClass(/dragging/)
  await svg.dispatchEvent('pointerup', { pointerId: 8, pointerType: 'mouse', button: 0, clientX: x + radius * .7, clientY: y + radius * .7 })
  await expect(dial).not.toHaveClass(/dragging/)
  await expect(page.locator('.orbit-selection b')).not.toHaveText('角宿')
  expect(await wheel.getAttribute('transform')).toMatch(/^rotate\(-?\d+(?:\.\d+)? 590 590\)$/)
})

for (const width of [320, 390]) {
  test(`${width}px clips the orbit without overflow and scrolls outside the ring`, async ({ page }) => {
    await page.setViewportSize({ width, height: 700 })
    await openHome(page)
    await expect(page.locator('.wheel-graphics')).toBeVisible()
    const size = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, client: document.documentElement.clientWidth, height: document.documentElement.scrollHeight }))
    expect(size.width).toBeLessThanOrEqual(size.client)
    expect(size.height).toBeGreaterThan(700)
    await page.mouse.move(8, 650)
    await page.mouse.wheel(0, 500)
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  })
}

test('a real drag coasts after release and settles without moving the orbit center', async ({ page }) => {
  await openHome(page)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  const wheel = page.locator('.wheel-graphics')
  const box = (await page.locator('.celestial-orbit svg').boundingBox())!
  const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  const radius = box.width * 475 / 1180
  await page.mouse.move(center.x + radius, center.y)
  await page.mouse.down()
  for (const angle of [-8, -16, -24, -32, -40]) {
    await page.mouse.move(center.x + radius * Math.cos(angle * Math.PI / 180), center.y + radius * Math.sin(angle * Math.PI / 180), { steps: 2 })
  }
  const releaseTransform = await wheel.getAttribute('transform')
  await page.mouse.up()
  await expect.poll(() => wheel.getAttribute('transform')).not.toBe(releaseTransform)
  await page.waitForFunction(async () => {
    const element = document.querySelector('.wheel-graphics')!
    const before = element.getAttribute('transform')
    for (let frame = 0; frame < 10; frame++) await new Promise(requestAnimationFrame)
    return element.getAttribute('transform') === before
  })
  const actual = await wheel.evaluate(element => {
    const matrix = (element as SVGGraphicsElement).getScreenCTM()!
    return { x: matrix.a * 590 + matrix.c * 590 + matrix.e, y: matrix.b * 590 + matrix.d * 590 + matrix.f }
  })
  expect(actual.x).toBeCloseTo(center.x, 1)
  expect(actual.y).toBeCloseTo(center.y, 1)
})

test('mobile landscape keeps hero and orbit free of horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 760, height: 390 })
  await openHome(page)
  await expect(page.locator('.hero-title')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  await page.locator('.hero-actions a').first().click({ trial: true })
})
