/**
 * Captures ChewClue at App Store iPhone 6.9" size: 1290 × 2796 (portrait).
 *
 * Prereqs:
 *   1. npm install (includes playwright)
 *   npx playwright install chromium
 *   2. npm run build   (uses your .env / Vite env for Supabase)
 *   3. Set credentials (never commit real passwords):
 *      export CHEWCLUE_SCREENSHOT_EMAIL="you@example.com"
 *      export CHEWCLUE_SCREENSHOT_PASSWORD="your-password"
 *   4. npm run screenshots
 *
 * Or serve yourself: npm run preview -- --port 4173
 *      export CHEWCLUE_SCREENSHOT_BASE_URL="http://127.0.0.1:4173"
 *      npm run screenshots -- --no-server
 */
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdir, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const outDir = path.join(root, 'screenshots', 'app-store')

// 6.9" portrait accepted size: 1290 × 2796 @3x → logical 430 × 932
const VIEWPORT = { width: 430, height: 932 }
const DEVICE_SCALE = 3

const email = process.env.CHEWCLUE_SCREENSHOT_EMAIL
const password = process.env.CHEWCLUE_SCREENSHOT_PASSWORD
const baseUrl = (process.env.CHEWCLUE_SCREENSHOT_BASE_URL || 'http://127.0.0.1:4173').replace(/\/$/, '')
const skipServer = process.argv.includes('--no-server')

async function waitForServer(url, maxMs = 90_000) {
  const start = Date.now()
  while (Date.now() - start < maxMs) {
    try {
      const res = await fetch(url, { redirect: 'follow' })
      if (res.ok || res.status === 304) return
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 400))
  }
  throw new Error(`Server not reachable: ${url}`)
}

function startPreview() {
  return new Promise((resolve, reject) => {
    const child = spawn('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', '4173', '--strictPort'], {
      cwd: root,
      shell: true,
      stdio: 'inherit',
      env: { ...process.env },
    })
    child.on('error', reject)
    resolve(child)
  })
}

async function signIn(page) {
  await page.goto(baseUrl + '/', { waitUntil: 'domcontentloaded' })
  const nav = page.locator('nav.bottom-nav')
  const authEmail = page.getByPlaceholder('Email')
  if (await nav.isVisible({ timeout: 3000 }).catch(() => false)) return
  if (!(await authEmail.isVisible({ timeout: 8000 }).catch(() => false))) {
    throw new Error('Neither auth nor app UI found. Is CHEWCLUE_SCREENSHOT_BASE_URL correct?')
  }
  await page.getByPlaceholder('Email').fill(email)
  await page.getByPlaceholder('Password').fill(password)
  await page.getByRole('button', { name: 'Sign In' }).click()
  await nav.waitFor({ state: 'visible', timeout: 30_000 })
}

async function shot(page, fileName) {
  await new Promise((r) => setTimeout(r, 400))
  await page.screenshot({
    path: path.join(outDir, fileName),
    type: 'png',
  })
}

async function main() {
  if (!email || !password) {
    console.error('Set CHEWCLUE_SCREENSHOT_EMAIL and CHEWCLUE_SCREENSHOT_PASSWORD')
    process.exit(1)
  }

  await mkdir(outDir, { recursive: true })
  for (const f of ['01-today.png', '02-log-food.png', '03-checkin.png', '04-insights.png', '05-settings.png']) {
    await rm(path.join(outDir, f), { force: true })
  }

  let previewProc = null
  if (!skipServer) {
    previewProc = await startPreview()
    await waitForServer(baseUrl + '/')
  } else {
    await waitForServer(baseUrl + '/')
  }

  const browser = await chromium.launch({ headless: true })
  try {
    const context = await browser.newContext({
      viewport: VIEWPORT,
      deviceScaleFactor: DEVICE_SCALE,
      colorScheme: 'light',
    })
    const page = await context.newPage()
    await signIn(page)

    await shot(page, '01-today.png')

    await page.goto(baseUrl + '/log', { waitUntil: 'domcontentloaded' })
    await page.locator('nav.bottom-nav').waitFor({ state: 'visible' })
    await shot(page, '02-log-food.png')

    await page.goto(baseUrl + '/checkin', { waitUntil: 'domcontentloaded' })
    await page.locator('nav.bottom-nav').waitFor({ state: 'visible' })
    await shot(page, '03-checkin.png')

    await page.goto(baseUrl + '/insights', { waitUntil: 'domcontentloaded' })
    await page.locator('nav.bottom-nav').waitFor({ state: 'visible' })
    await shot(page, '04-insights.png')

    await page.goto(baseUrl + '/settings', { waitUntil: 'domcontentloaded' })
    await page.locator('nav.bottom-nav').waitFor({ state: 'visible' })
    await shot(page, '05-settings.png')

    console.log(`\nDone. PNGs (${VIEWPORT.width * DEVICE_SCALE}×${VIEWPORT.height * DEVICE_SCALE}):`)
    console.log(outDir)
  } finally {
    await browser.close()
    if (previewProc && !previewProc.killed) {
      previewProc.kill('SIGTERM')
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
