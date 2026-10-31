import { chromium } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const artifactDir = '/Users/ayush/.gemini/antigravity-ide/brain/e1d78d2e-dc0e-4559-9e24-86c849f99123'

async function run() {
  console.log('--- Starting Quakeline Story Verification ---')
  const browser = await chromium.launch({ headless: true })
  const consoleErrors = []

  // 1. Desktop 1440px
  const context1440 = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  })
  const page1440 = await context1440.newPage()
  page1440.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(`[1440 console error]: ${msg.text()}`)
    }
  })
  page1440.on('pageerror', (err) => {
    consoleErrors.push(`[1440 pageerror]: ${err.message}`)
  })

  console.log('Navigating to http://localhost:5175/ at 1440px...')
  await page1440.goto('http://localhost:5175/', { waitUntil: 'networkidle' })
  await page1440.waitForTimeout(1000)

  // Verify gate is displayed
  const followBtn = page1440.locator('.gate-btn', { hasText: 'Follow one' })
  await followBtn.waitFor({ state: 'visible' })
  console.log('Gate is displayed on load. Clicking "Follow one"...')
  await followBtn.click()

  // Wait for gate wipe animation to complete and gate to detach
  await page1440.waitForSelector('.gate', { state: 'detached' })
  await page1440.waitForTimeout(1000)

  // Screenshot Ch 01 Orbit at 1440px
  const card1440OrbitPath = path.join(artifactDir, 'card-orbit-1440.png')
  const orbitCard = page1440.locator('[data-ch="orbit"] .ch-card')
  await orbitCard.screenshot({ path: card1440OrbitPath })
  console.log(`Saved Orbit card at 1440px: ${card1440OrbitPath}`)

  // Scroll to Chapter 2 Dive
  const diveSection = page1440.locator('[data-ch="dive"]')
  await diveSection.scrollIntoViewIfNeeded()
  await page1440.waitForTimeout(1500)
  const card1440DivePath = path.join(artifactDir, 'card-dive-1440.png')
  const diveCard = page1440.locator('[data-ch="dive"] .ch-card')
  await diveCard.screenshot({ path: card1440DivePath })
  console.log(`Saved Dive card at 1440px: ${card1440DivePath}`)

  await context1440.close()

  // 2. Mobile 390px
  const context390 = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
    isMobile: true,
    hasTouch: true,
  })
  const page390 = await context390.newPage()
  page390.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(`[390 console error]: ${msg.text()}`)
    }
  })
  page390.on('pageerror', (err) => {
    consoleErrors.push(`[390 pageerror]: ${err.message}`)
  })

  console.log('Navigating to http://localhost:5175/ at 390px...')
  await page390.goto('http://localhost:5175/', { waitUntil: 'networkidle' })
  await page390.waitForTimeout(1000)

  const followBtn390 = page390.locator('.gate-btn', { hasText: 'Follow one' })
  await followBtn390.waitFor({ state: 'visible' })
  await followBtn390.click()
  await page390.waitForSelector('.gate', { state: 'detached' })
  await page390.waitForTimeout(1000)

  const card390OrbitPath = path.join(artifactDir, 'card-orbit-390.png')
  await page390.locator('[data-ch="orbit"] .ch-card').screenshot({ path: card390OrbitPath })
  console.log(`Saved Orbit card at 390px: ${card390OrbitPath}`)

  const diveSection390 = page390.locator('[data-ch="dive"]')
  await diveSection390.scrollIntoViewIfNeeded()
  await page390.waitForTimeout(1500)
  const card390DivePath = path.join(artifactDir, 'card-dive-390.png')
  await page390.locator('[data-ch="dive"] .ch-card').screenshot({ path: card390DivePath })
  console.log(`Saved Dive card at 390px: ${card390DivePath}`)

  await context390.close()

  // 3. Rupture HOLD tests (Space for 8s, Touch hold, Mouse hold)
  const testContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  })
  const page = await testContext.newPage()
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(`[test console error]: ${msg.text()}`)
    }
  })
  page.on('pageerror', (err) => {
    consoleErrors.push(`[test pageerror]: ${err.message}`)
  })

  await page.goto('http://localhost:5175/', { waitUntil: 'networkidle' })
  await page.locator('.gate-btn', { hasText: 'Follow one' }).click()
  await page.waitForTimeout(1200)

  // Scroll to Chapter 4 Rupture
  const ruptureSection = page.locator('[data-ch="rupture"]')
  await ruptureSection.scrollIntoViewIfNeeded()
  await page.waitForTimeout(1200)

  const ruptureBox = await ruptureSection.boundingBox()
  console.log(`Rupture section y: ${ruptureBox.y}, height: ${ruptureBox.height}`)

  // --- Test A: Hold Space for 8 seconds straight, then release ---
  console.log('\n--- Test A: Space hold for 8s ---')
  const holdBtn = page.locator('.hold')
  await holdBtn.waitFor({ state: 'visible' })
  await holdBtn.focus()

  const scrollYBeforeHold = await page.evaluate(() => window.scrollY)
  console.log(`scrollY before hold: ${scrollYBeforeHold}`)

  console.log('Pressing Space down and holding for 8 seconds...')
  await page.keyboard.down('Space')
  // Wait 8 seconds
  await page.waitForTimeout(8000)
  console.log('Releasing Space...')
  await page.keyboard.up('Space')
  await page.waitForTimeout(500)

  const scrollYAfterHold = await page.evaluate(() => window.scrollY)
  console.log(`scrollY after 8s hold and release: ${scrollYAfterHold}`)

  const scrollDiff = Math.abs(scrollYAfterHold - scrollYBeforeHold)
  if (scrollDiff > 2) {
    throw new Error(`FAIL: Page scrolled by ${scrollDiff}px during Space hold!`)
  }
  console.log(`PASS: Page did not scroll during Space hold (diff: ${scrollDiff}px)`)

  // Check that caption and cue are visible
  const cue = page.locator('.rig-cue')
  const caption = page.locator('.rig-after')
  await cue.waitFor({ state: 'visible' })
  await caption.waitFor({ state: 'visible' })
  console.log('PASS: Caption and cue are visible after rupture')

  // Dispatch one wheel event to continue the story
  console.log('Dispatching one wheel event (deltaY: 100)...')
  await page.mouse.wheel(0, 100)
  await page.waitForTimeout(1000)

  const scrollYAfterWheel = await page.evaluate(() => window.scrollY)
  console.log(`scrollY after wheel: ${scrollYAfterWheel}`)
  if (scrollYAfterWheel <= scrollYAfterHold) {
    throw new Error(`FAIL: Story did not continue after wheel event! scrollY stayed at ${scrollYAfterWheel}`)
  }
  console.log('PASS: Story continued on deliberate wheel event!')

  // --- Test B: Reset and Mouse Hold for 8s ---
  console.log('\n--- Test B: Mouse hold on .hold for 8s ---')
  // Scroll back up to reset rupture
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(800)
  await ruptureSection.scrollIntoViewIfNeeded()
  await page.waitForTimeout(800)

  const holdBtnB = page.locator('.hold')
  await holdBtnB.waitFor({ state: 'visible' })
  const scrollYBeforeMouse = await page.evaluate(() => window.scrollY)

  const btnBox = await holdBtnB.boundingBox()
  await page.mouse.move(btnBox.x + btnBox.width / 2, btnBox.y + btnBox.height / 2)
  console.log('Mouse down on .hold for 8 seconds...')
  await page.mouse.down()
  await page.waitForTimeout(8000)
  console.log('Mouse up...')
  await page.mouse.up()
  await page.waitForTimeout(500)

  const scrollYAfterMouse = await page.evaluate(() => window.scrollY)
  console.log(`scrollY after mouse hold: ${scrollYAfterMouse}`)
  if (Math.abs(scrollYAfterMouse - scrollYBeforeMouse) > 2) {
    throw new Error(`FAIL: Page scrolled during mouse hold!`)
  }
  console.log('PASS: Page did not scroll during mouse hold')

  await cue.waitFor({ state: 'visible' })
  console.log('Clicking the cue button to follow the waves...')
  await cue.click()
  await page.waitForTimeout(1000)

  const scrollYAfterCueClick = await page.evaluate(() => window.scrollY)
  console.log(`scrollY after cue click: ${scrollYAfterCueClick}`)
  if (scrollYAfterCueClick <= scrollYAfterMouse) {
    throw new Error(`FAIL: Clicking cue button did not advance the story!`)
  }
  console.log('PASS: Clicking cue advanced the story!')

  // --- Test C: Touch Hold for 8s on Mobile Context ---
  console.log('\n--- Test C: Touch hold for 8s on mobile context ---')
  const touchCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  })
  const touchPage = await touchCtx.newPage()
  await touchPage.goto('http://localhost:5175/', { waitUntil: 'networkidle' })
  await touchPage.locator('.gate-btn', { hasText: 'Follow one' }).click()
  await touchPage.waitForTimeout(1000)

  const touchRupture = touchPage.locator('[data-ch="rupture"]')
  await touchRupture.scrollIntoViewIfNeeded()
  await touchPage.waitForTimeout(800)

  const touchHoldBtn = touchPage.locator('.hold')
  await touchHoldBtn.waitFor({ state: 'visible' })
  const tBox = await touchHoldBtn.boundingBox()

  const touchScrollBefore = await touchPage.evaluate(() => window.scrollY)
  console.log('Starting touch hold for 8s on .hold...')
  await touchHoldBtn.dispatchEvent('pointerdown', { pointerId: 1, pointerType: 'touch' })
  await touchPage.waitForTimeout(8000)
  await touchHoldBtn.dispatchEvent('pointerup', { pointerId: 1, pointerType: 'touch' })
  await touchPage.waitForTimeout(500)

  const touchScrollAfter = await touchPage.evaluate(() => window.scrollY)
  console.log(`Touch scroll diff: ${Math.abs(touchScrollAfter - touchScrollBefore)}px`)
  if (Math.abs(touchScrollAfter - touchScrollBefore) > 2) {
    throw new Error('FAIL: Page scrolled during touch hold!')
  }
  console.log('PASS: Touch hold stayed within range!')

  const touchCue = touchPage.locator('.rig-cue')
  await touchCue.waitFor({ state: 'visible' })
  console.log('PASS: Cue is visible after touch rupture!')

  console.log('Dispatching touch swipe after grace period...')
  await touchPage.waitForTimeout(800)
  await touchPage.evaluate(() => {
    const tStart = new Touch({ identifier: 1, target: window.document.body, clientX: 200, clientY: 500 })
    window.dispatchEvent(new TouchEvent('touchstart', { touches: [tStart], changedTouches: [tStart] }))
    const tMove = new Touch({ identifier: 1, target: window.document.body, clientX: 200, clientY: 300 })
    window.dispatchEvent(new TouchEvent('touchmove', { touches: [tMove], changedTouches: [tMove] }))
    window.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [tMove] }))
  })
  await touchPage.waitForTimeout(1000)
  const touchScrollFinal = await touchPage.evaluate(() => window.scrollY)
  console.log(`Touch scroll final: ${touchScrollFinal}`)
  if (touchScrollFinal <= touchScrollAfter) {
    throw new Error('FAIL: Deliberate touch swipe did not advance story after rupture!')
  }
  console.log('PASS: Touch deliberate swipe advanced story!')

  await touchCtx.close()
  await testContext.close()
  await browser.close()

  console.log('\n--- Console Errors Check ---')
  if (consoleErrors.length > 0) {
    console.error('Console errors found:', consoleErrors)
    throw new Error(`Console errors occurred: ${JSON.stringify(consoleErrors)}`)
  } else {
    console.log('PASS: Zero console errors!')
  }

  console.log('\nALL VERIFICATIONS PASSED SUCCESSFULLY!')
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
