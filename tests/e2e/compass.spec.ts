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

test('uses actual catalog stars rather than a repeated decorative pattern', async ({ page }) => {
  await openHome(page)
  const stars = (name: string) => page.locator(`[data-name="${name}"] .cluster-star`)
  await expect(stars('角')).toHaveCount(2)
  await expect(stars('心')).toHaveCount(3)
  await expect(stars('参')).toHaveCount(7)
  await expect(stars('奎')).toHaveCount(16)
  expect(await stars('角').evaluateAll(items => items.map(item => Number(item.getAttribute('data-hip'))))).toEqual([65474, 66249])
  await page.locator('.star-source').click()
  await expect(page.locator('.star-atlas figure')).toHaveCount(28)
  await expect(page.locator('h1')).toHaveText('二十八宿星图与资料来源')
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

test('selected mansion exposes a working configurable reading link', async ({ page }) => {
  await openHome(page)
  const reading = page.locator('.mansion-readings a')
  await expect(reading).toHaveText('黄帝内经 ↗')
  await page.getByTestId('constellation-dial').focus()
  await page.keyboard.press('End')
  await expect(reading).toHaveText('神农本草经 ↗')
  await reading.click()
  await expect(page.locator('h1')).toHaveText('神农本草经')
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

test('clicking either half keeps the selected constellation on that half', async ({ page }) => {
  await openHome(page)
  const dial = page.getByTestId('constellation-dial')
  const svgBox = (await dial.locator('svg').boundingBox())!
  const centerX = svgBox.x + svgBox.width / 2
  const selectedX = () => page.locator('.mansion.selected .mansion-star').evaluate(element => {
    const circle = element as SVGCircleElement
    const point = new DOMPoint(circle.cx.baseVal.value, circle.cy.baseVal.value)
    return point.matrixTransform(circle.getScreenCTM()!).x
  })
  await page.locator('[data-name="奎"] .mansion-hit').click()
  await expect(dial).toHaveAttribute('data-focus-side', 'right')
  await expect(page.locator('.orbit-selection b')).toHaveText('奎宿')
  expect(await selectedX()).toBeGreaterThan(centerX + 200)
  await page.locator('[data-name="房"] .mansion-hit').click()
  await expect(dial).toHaveAttribute('data-focus-side', 'left')
  await expect(page.locator('.orbit-selection b')).toHaveText('房宿')
  expect(await selectedX()).toBeLessThan(centerX - 200)
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

test.describe('native mobile touch gestures', () => {
  test.use({ hasTouch: true, isMobile: true })
  for (const width of [320, 390, 430]) {
    test(`${width}px keeps both sides reachable and rotates with a real touch drag`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 })
      await openHome(page)
      const wheel = page.locator('.wheel-graphics')
      const geometry = await page.locator('.celestial-orbit svg').evaluate(element => {
        const rect = element.getBoundingClientRect()
        return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, radius: rect.width * 475 / 1180 }
      })
      const x = geometry.x + geometry.radius, y = geometry.y
      expect(geometry.x - geometry.radius).toBeGreaterThan(24)
      expect(x).toBeLessThan(width - 24)
      for (const sideX of [geometry.x - geometry.radius, x]) {
        expect(await page.evaluate(({ x, y }) => !!document.elementFromPoint(x, y)?.closest('.celestial-orbit'), { x: sideX, y })).toBe(true)
      }
      const client = await page.context().newCDPSession(page)
      const initial = await wheel.getAttribute('transform')
      await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] })
      for (const angle of [-8, -16, -24, -32, -40]) {
        await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{
          x: geometry.x + geometry.radius * Math.cos(angle * Math.PI / 180),
          y: geometry.y + geometry.radius * Math.sin(angle * Math.PI / 180), id: 1,
        }] })
      }
      await expect(wheel).not.toHaveAttribute('transform', initial!)
      await expect(page.getByTestId('constellation-dial')).toHaveClass(/dragging/)
      await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
      await expect(page.getByTestId('constellation-dial')).not.toHaveClass(/dragging/)
      expect(await page.evaluate(() => window.scrollY)).toBe(0)
      await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: width / 2, y: 740, id: 2 }] })
      for (const nextY of [690, 640, 590, 540]) await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: width / 2, y: nextY, id: 2 }] })
      await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(50)
    })
  }
})
